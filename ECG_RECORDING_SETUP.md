# ECG Recording & ML Classification Setup

## Overview
โครงการนี้ได้ถูกอัพเดตให้สามารถบันทึก ECG เป็นเวลา 10 วินาที กรอกค่าลงใน form และส่งไปยัง ML backend สำหรับประเมินผล

## Components Created/Modified

### 1. **ECG Context** (`src/context/ecg-context.tsx`)
- ✅ จัดการสถานะการบันทึก ECG data
- ✅ ติดตามระยะเวลาการบันทึก (0-10 วินาที)
- ✅ เก็บข้อมูล ECG สำหรับ 3 leads (lead1, lead2, lead3)

**Functions:**
```typescript
startRecording()      // เริ่มบันทึก ECG 10 วินาที
stopRecording()       // หยุดบันทึก
clearRecording()      // ล้างข้อมูลการบันทึก
addEcgSample(lead, value) // เพิ่ม sample ไปยัง lead ที่ระบุ
```

### 2. **ECG Sensor Card** (`src/components/ecg-sensor-card.tsx`)
- ✅ เพิ่มปุ่ม "Record (10s)" สำหรับเริ่มการบันทึก
- ✅ เพิ่มปุ่ม "Stop" สำหรับหยุดการบันทึก
- ✅ แสดงสถานะการบันทึกแบบ real-time
- ✅ ส่งข้อมูล ECG samples ไปยัง context โดยอัตโนมัติ

**ประสิทธิภาพ:**
- Sample rate: 125 Hz
- Recording duration: 10 วินาที
- Expected samples: 1,250 samples ต่อ lead

### 3. **CardioCapForm** (`src/components/cardiocap-form.tsx`)
- ✅ Auto-fill ECG lead fields เมื่อการบันทึกเสร็จ
- ✅ Support both array data (จาก recording) และ numeric data
- ✅ Parse JSON-serialized ECG arrays
- ✅ Send ECG data ไปยัง ML backend

**ขั้นตอน:**
1. บันทึก ECG → data ถูก serialize เป็น JSON
2. Auto-fill form fields
3. Send ไปยัง Flask backend สำหรับ classification
4. ประเมินผลโดย Genkit + Firebase

### 4. **Firebase Actions** (`src/firebase/actions.ts`)
- ✅ Enhanced schema เพื่อรับทั้ง numbers และ arrays
- ✅ Integration กับ Flask backend (`http://localhost:5000/ecg-model`)
- ✅ Graceful fallback หากไม่มี Flask backend

### 5. **Root Layout** (`src/app/layout.tsx`)
- ✅ Wrapped app ด้วย `<EcgProvider>`
- ✅ ทำให้ ECG context accessible ทั่วทั้ง app

## Workflow

### การใช้งาน
1. **Open Sensor Page** (`/open-sensor`)
   - ดูโปรแกรม ECG real-time
   
2. **Record ECG**
   - Click "Record (10s)" button
   - ตรวจสอบ counter แสดง 0s → 10.0s
   - ECG samples ถูกเก็บโดยอัตโนมัติ

3. **Auto-fill Form**
   - เมื่อบันทึกเสร็จ form จะถูก auto-fill
   - Toast notification จะแสดง "ECG Recording Loaded"
   - Navigate ไปยัง form page

4. **Submit Analysis**
   - Fill ข้อมูลผู้ป่วย (name, age, oxy saturation เป็นต้น)
   - Click "Analyze" button
   - ECG data ถูกส่งไปยัง Flask backend (ถ้ามี)
   - AI ประเมินผลและแสดง results

## Technical Details

### ECG Data Format
```typescript
{
  lead1: [0.5, 0.6, 0.7, ...], // 1,250 samples @ 125Hz
  lead2: [0.4, 0.5, 0.6, ...], 
  lead3: [0.3, 0.4, 0.5, ...],
  timestamp: Date
}
```

### API Integration

#### Flask Backend (Optional)
**Endpoint:** `POST /ecg-model`
```json
{
  "lead1": [0.5, 0.6, ...],
  "lead2": [0.4, 0.5, ...],
  "lead3": [0.3, 0.4, ...]
}
```

**Response:**
```json
{
  "overall_prediction": "Normal Beat",
  "average_probabilities": {...},
  "num_beats_detected": 12
}
```

#### Genkit + Firebase (Required)
Processes clinical summary, heart failure risk, and comprehensive assessment.

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
python ecg_app.py
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
| `src/context/ecg-context.tsx` | ✨ Created - ECG state management |
| `src/components/ecg-sensor-card.tsx` | 🔄 Updated - Added record/stop buttons |
| `src/components/cardiocap-form.tsx` | 🔄 Updated - Auto-fill, ML integration |
| `src/firebase/actions.ts` | 🔄 Updated - Flask backend integration |
| `src/app/layout.tsx` | 🔄 Updated - Added EcgProvider |

## Testing Checklist

- [ ] Record ECG for 10 seconds
- [ ] Form auto-fills after recording
- [ ] Submit form with ECG data
- [ ] Flask classification works (if backend running)
- [ ] Genkit analysis completes
- [ ] Results displayed correctly
- [ ] Data saved to Firestore

## Troubleshooting

**Issue:** Form fields not auto-filling
- Check browser console for errors
- Verify ECG context is wrapped in layout

**Issue:** Flask backend connection error
- Ensure Flask server running on port 5000
- Check CORS settings in Flask app
- App will fallback to default classification

**Issue:** ECG data looks wrong
- Verify esp-data events are firing
- Check sample normalization: `(data.ecg - 2048) / 100`
- Inspect browser DevTools for event data

## Next Steps

1. **Test with real ECG hardware**
2. **Optimize recording buffer size**
3. **Add offline support**
4. **Implement data export (CSV/PDF)**
5. **Add trend analysis over time**
