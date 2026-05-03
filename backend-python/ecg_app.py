from flask import Flask, request, jsonify
import tensorflow as tf
import numpy as np

app = Flask(__name__)

modelECG = tf.keras.models.load_model("model/ECG96_model.h5")

FIXED_LENGTH = 187      # MIT-BIH beat length used in training
SAMPLE_RATE  = 125      # Hz — dataset was re-sampled to 125 Hz
RPEAK_THRESH = 0.9      # threshold on normalised amplitude for R-peak detection
WINDOW_SEC   = 10       # seconds per analysis window
WINDOW_LEN   = SAMPLE_RATE * WINDOW_SEC   # 1250 samples
# CLASSES      = ['N', 'S', 'V', 'F', 'Q']
CLASSES = [
    'Normal Beat',
    'Supraventricular Premature Beat',
    'Premature Ventricular Contraction',
    'Fusion of Ventricular and Normal Beat',
    'Paced / Unclassifiable Beat'
]


# ──────────────────────────────────────────────
# PREPROCESSING  (follows the paper exactly)
# ──────────────────────────────────────────────

def extract_beats(raw_signal: np.ndarray) -> list[np.ndarray]:
    """
    Given a 1-D ECG signal (any length, already at 125 Hz),
    return a list of zero-padded beat arrays each of length FIXED_LENGTH.

    Steps from the paper:
      1. Split into 10-second windows
      2. Normalise amplitude to [0, 1]
      3. Find local maxima via zero-crossings of the first derivative
      4. Keep only candidates above 0.9 of the normalised max  → R-peaks
      5. Compute median R-R interval T
      6. For each R-peak extract a window of length 1.2 * T
      7. Zero-pad to FIXED_LENGTH
    """
    beats = []

    # ── Step 1: iterate over 10-second windows ──
    num_windows = max(1, len(raw_signal) // WINDOW_LEN)

    for w in range(num_windows):
        window = raw_signal[w * WINDOW_LEN : (w + 1) * WINDOW_LEN]

        if len(window) < 10:          # skip tiny trailing windows
            continue

        # ── Step 2: normalise to [0, 1] ──
        w_min, w_max = window.min(), window.max()
        if w_max == w_min:
            continue                  # flat line — skip
        norm = (window - w_min) / (w_max - w_min)

        # ── Step 3: local maxima via first-derivative zero-crossings ──
        diff = np.diff(norm)
        # zero-crossing: derivative changes from + to -
        local_max_idx = np.where((diff[:-1] > 0) & (diff[1:] <= 0))[0] + 1

        if len(local_max_idx) == 0:
            continue

        # ── Step 4: R-peak candidates above threshold ──
        r_peaks = local_max_idx[norm[local_max_idx] >= RPEAK_THRESH]

        if len(r_peaks) < 2:
            continue

        # ── Step 5: median R-R interval T ──
        rr_intervals = np.diff(r_peaks)
        T = int(np.median(rr_intervals))

        if T == 0:
            continue

        beat_len = int(1.2 * T)       # Step 6 length

        # ── Steps 6 & 7: extract and zero-pad ──
        for r in r_peaks:
            start = r
            end   = r + beat_len

            if end > len(norm):
                segment = norm[start:]
            else:
                segment = norm[start:end]

            # zero-pad to FIXED_LENGTH
            beat = np.zeros(FIXED_LENGTH)
            copy_len = min(len(segment), FIXED_LENGTH)
            beat[:copy_len] = segment[:copy_len]

            beats.append(beat)

    return beats


def predict_beats(beats: list[np.ndarray]) -> dict:
    """
    Run the model on a list of extracted beats and return
    per-beat predictions plus an overall (majority-vote) prediction.
    """
    if not beats:
        return {"error": "No valid beats could be extracted from the signal"}

    X = np.array(beats).reshape(-1, FIXED_LENGTH, 1)   # (N, 187, 1)
    probs = modelECG.predict(X, verbose=0)              # (N, 5)

    per_beat = [
        {
            "beat_index": i,
            "prediction": CLASSES[np.argmax(p)],
            "probabilities": {CLASSES[j]: round(float(p[j]), 4) for j in range(5)}
        }
        for i, p in enumerate(probs)
    ]

    # majority vote across all beats
    votes      = [np.argmax(p) for p in probs]
    majority   = int(np.bincount(votes).argmax())
    avg_probs  = probs.mean(axis=0)

    return {
        "overall_prediction": CLASSES[majority],
        "average_probabilities": {CLASSES[j]: round(float(avg_probs[j]), 4) for j in range(5)},
        "num_beats_detected": len(beats),
        "per_beat": per_beat
    }


# ──────────────────────────────────────────────
# ROUTES
# ──────────────────────────────────────────────

@app.route("/")
def index():
    return "<h1>ECG Classification API</h1><p>POST raw signal to /ecg-model</p>"


@app.route("/ecg-model", methods=["POST"])
def ecg_model():
    """
    Accepts JSON with one or more leads.

    Single-lead  (matches training):
        { "lead2": [0.1, 0.2, ...] }          ← list of float samples at 125 Hz

    Multi-lead  (lead1, lead2, lead3):
        { "lead1": [...], "lead2": [...], "lead3": [...] }

    For multi-lead input, beats are extracted from each lead independently
    and predictions are averaged (ensemble).

    Returns per-beat predictions + an overall prediction.
    """
    data = request.get_json(force=True)

    if not data:
        return jsonify({"error": "No JSON body received"}), 400

    # ── collect whichever leads were sent ──
    lead_keys = [k for k in ("lead1", "lead2", "lead3") if k in data]

    if not lead_keys:
        return jsonify({"error": "Provide at least one of: lead1, lead2, lead3"}), 400

    # ── single-lead path ──
    if len(lead_keys) == 1:
        signal = np.array(data[lead_keys[0]], dtype=np.float32)
        beats  = extract_beats(signal)
        result = predict_beats(beats)
        result["lead_used"] = lead_keys[0]
        return jsonify(result)

    # ── multi-lead ensemble path ──
    all_avg_probs = []

    for key in lead_keys:
        signal = np.array(data[key], dtype=np.float32)
        beats  = extract_beats(signal)

        if not beats:
            continue

        X     = np.array(beats).reshape(-1, FIXED_LENGTH, 1)
        probs = modelECG.predict(X, verbose=0)
        all_avg_probs.append(probs.mean(axis=0))

    if not all_avg_probs:
        print("ERROR FROM")
        return jsonify({"error": "No valid beats extracted from any lead"}), 422

    ensemble = np.mean(all_avg_probs, axis=0)
    return jsonify({
        "overall_prediction":    CLASSES[int(np.argmax(ensemble))],
        "average_probabilities": {CLASSES[j]: round(float(ensemble[j]), 4) for j in range(5)},
        "leads_used":            lead_keys
    })


@app.route("/ecg-model/pre-segmented", methods=["POST"])
def ecg_model_presegmented():
    """
    If your signal is ALREADY segmented into 187-sample beats
    (e.g. directly from the Kaggle mitbih CSV), skip preprocessing.

    Accepts:
        { "beats": [[...187 values...], [...], ...] }
    """
    data = request.get_json(force=True)

    if "beats" not in data:
        return jsonify({"error": "Provide a 'beats' key with a list of 187-sample arrays"}), 400

    beats = [np.array(b, dtype=np.float32) for b in data["beats"]]
    result = predict_beats(beats)
    return jsonify(result)


# ── run ──
# flask --app ecg_app run
if __name__ == "__main__":
    app.run(debug=True)
