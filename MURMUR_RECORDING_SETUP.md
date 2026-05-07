# Murmur Recording & ML Classification Setup

## Overview
โครงการนี้ได้ถูกอัพเดตให้สามารถบันทึก Murmur (เสียงหัวใจผิดปกติ) เป็นเวลา 10 วินาที กรอกค่าลงใน form และส่งไปยัง ML backend สำหรับประเมินผล

## Components Created/Modified

### 1. **Murmur Context** (`src/context/murmur-context.tsx`)
- ✅ จัดการสถานะการบันทึก Murmur audio data
- ✅ ติดตามระยะเวลาการบันทึก (0-10 วินาที)
- ✅ เก็บข้อมูล audio samples สำหรับการวิเคราะห์

**Functions:**
```typescript
startRecording()      // เริ่มบันทึก Murmur 10 วินาที
stopRecording()       // หยุดบันทึก
clearRecording()      // ล้างข้อมูลการบันทึก
addMurmurSample(value) // เพิ่ม audio sample ไปยังการบันทึก
```

### 2. **Stethoscope Sensor Card** (`src/components/stethoscope-sensor-card.tsx`)
- ✅ เพิ่มปุ่ม "Record (10s)" สำหรับเริ่มการบันทึก
- ✅ เพิ่มปุ่ม "Stop Recording (10s)" สำหรับหยุดการบันทึก
- ✅ แสดงสถานะการบันทึกแบบ real-time
- ✅ ส่งข้อมูล Murmur audio samples ไปยัง context โดยอัตโนมัติ
- ✅ รวมข้อมูล BPM, SpO2, Temperature

**ประสิทธิภาพ:**
- Sample rate: 4000 Hz (Phonocardiogram typical rate)
- Recording duration: 10 วินาที
- Expected samples: 40,000 samples
- Waveform visualization: 400 samples buffer

### 3. **CardioCapForm** (`src/components/cardiocap-form.tsx`)
- ✅ Auto-fill Murmur audio field เมื่อการบันทึกเสร็จ
- ✅ Support JSON-serialized audio arrays
- ✅ Parse murmur audio data for backend submission
- ✅ Send Murmur data ไปยัง ML backend สำหรับ classification

**ขั้นตอน:**
1. บันทึก Murmur → data ถูก serialize เป็น JSON
2. Auto-fill form fields
3. Send ไปยัง Flask backend สำหรับ classification (optional)
4. ประเมินผลโดย Genkit + Firebase

### 4. **Root Layout** (`src/app/layout.tsx`)
- ✅ Wrapped app ด้วย `<MurmurProvider>`
- ✅ ทำให้ Murmur context accessible ทั่วทั้ง app

## Workflow

### การใช้งาน
1. **Open Sensor Page** (`/open-sensor`)
   - ดูโปรแกรม Stethoscope real-time
   - Monitor BPM, SpO2, Temperature
   
2. **Record Murmur**
   - Click "Record (10s)" button
   - ตรวจสอบ counter แสดง 0s → 10.0s
   - Audio samples ถูกเก็บโดยอัตโนมัติ
   - Waveform visualization แสดง real-time
   - Progress bar แสดง recording progress

3. **Auto-fill Form**
   - เมื่อบันทึกเสร็จ form จะถูก auto-fill
   - Toast notification จะแสดง "Murmur Recording Loaded"
   - Navigate ไปยัง form page

4. **Submit Analysis**
   - Fill ข้อมูลผู้ป่วย (name, age, murmur grade เป็นต้น)
   - Click "Analyze" button
   - Murmur data ถูกส่งไปยัง Flask backend (ถ้ามี)
   - AI ประเมินผลและแสดง results

## Technical Details

### Murmur Data Format
```typescript
{
  audioData: [0.5, 0.6, 0.7, ...],  // 40,000 samples @ 4000Hz
  timestamp: Date
}
```

### Waveform Processing
- **Filter Type**: Bandpass (IIR)
- **High-pass component**: α = 0.95
- **Low-pass component**: β = 0.05
- **Normalization**: (rawValue - 2048) / 120
- **Buffer size**: 400 samples for visualization

### API Integration

#### Flask Backend (Optional)
**Endpoint:** `POST /murmur-model`
```json
{
  "audioData": [0.5, 0.6, ...]
}
```

**Response:**
```json
{
  "murmur_detected": true,
  "murmur_type": "Holosystolic",
  "confidence": 0.85,
  "heart_cycle": {
    "s1": 0.2,
    "s2": 0.5,
    "systole": 0.3,
    "diastole": 0.7
  },
  "audio_quality": "Good"
}
```

#### Genkit + Firebase (Required)
Processes clinical summary, heart failure risk, and comprehensive assessment including murmur analysis.

## Setup Instructions

### Prerequisites
```bash
# Node.js 18+
node --version

# Python 3.8+ (for Flask backend - optional)
python --version
```

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# (Optional) Start Flask backend
cd backend-python
source venv/bin/activate  # Windows: venv\Scripts\activate
python murmur_app.py
```

### Environment Variables
```env
# .env.local
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
# ... other Firebase config
```

## File Changes Summary

| File | Changes |
|------|---------|
| `src/context/murmur-context.tsx` | ✨ Created - Murmur state management |
| `src/components/stethoscope-sensor-card.tsx` | 🔄 Updated - Added record/stop buttons, integrated murmur context |
| `src/components/cardiocap-form.tsx` | 🔄 Updated - Auto-fill, Murmur ML integration, import murmur context |
| `src/app/layout.tsx` | 🔄 Updated - Added MurmurProvider |

## Testing Checklist

- [ ] Record Murmur for 10 seconds
- [ ] Waveform visualization shows real-time audio
- [ ] Form auto-fills after recording
- [ ] BPM, SpO2, Temp displayed correctly
- [ ] Submit form with Murmur data
- [ ] Flask classification works (if backend running)
- [ ] Genkit analysis completes
- [ ] Results displayed correctly
- [ ] Data saved to Firestore
- [ ] Download WAV file works

## Troubleshooting

**Issue:** Form fields not auto-filling
- Check browser console for errors
- Verify Murmur context is wrapped in layout
- Check if recording actually saved samples

**Issue:** No waveform visualization
- Ensure esp-data events are firing with `pcg` property
- Check sample normalization: `(data.pcg - 2048) / 120`
- Verify canvas reference is properly set

**Issue:** Recording stops before 10 seconds
- Check if timer is correctly implemented
- Verify stopRecording() is only called at 10s
- Check sample buffer size limits

**Issue:** Flask backend connection error
- Ensure Flask server running on port 5000
- Check CORS settings in Flask app
- Verify audio format matches backend expectations
- App will work without backend (uses dummy predictions)

## Real-time Monitoring

### Progress Indicator
- Visual progress bar: 0% → 100% (10 seconds)
- Time display: "0s / 10s" → "10.0s / 10s"
- Recording status: "Recording..." or "Ready to Record"

### Vital Signs Display
- **BPM**: Heart rate from PPG sensor
- **SpO2**: Oxygen saturation percentage
- **Temp**: Body temperature in Celsius

## Next Steps

1. **Test with real Stethoscope hardware**
2. **Validate audio quality metrics**
3. **Optimize recording buffer size**
4. **Implement offline support**
5. **Add audio playback for verification**
6. **Implement trend analysis over time**
7. **Add multi-site recording (aortic, mitral, tricuspid, pulmonic)**

## Architecture Comparison: ECG vs Murmur

| Aspect | ECG | Murmur |
|--------|-----|--------|
| Sample Rate | 125 Hz | 4000 Hz |
| Duration | 10s | 10s |
| Total Samples | 1,250 | 40,000 |
| Leads | 3 (lead1, lead2, lead3) | 1 (mono audio) |
| Filter | None (raw data) | Bandpass IIR |
| Data Type | Numeric array | Audio samples |
| Context Hook | useEcgRecording() | useMurmurRecording() |
| Context Field | lead1/lead2/lead3 | audioData |
