import base64
import os
import uuid
from datetime import datetime

import cv2
import numpy as np
from django.conf import settings
from django.utils import timezone

from cameras.models import Camera, TrafficSign
from violations.services import create_violation_with_fine

from .models import AIDetectionLog

# ── colour palette for bounding boxes (by label hash) ──────────
_BOX_COLORS = [
    (124, 58, 237), (239, 68, 68), (245, 158, 11), (22, 163, 74),
    (59, 130, 246), (168, 85, 247), (249, 115, 22), (20, 184, 166),
    (236, 72, 153), (99, 102, 241), (234, 179, 8), (6, 182, 212),
]


def _color_for(label):
    return _BOX_COLORS[hash(label) % len(_BOX_COLORS)]


def _frame_to_base64(frame, max_width=1280):
    """Encode an OpenCV frame as a base64 JPEG string (data-URI ready)."""
    h, w = frame.shape[:2]
    if w > max_width:
        scale = max_width / w
        frame = cv2.resize(frame, (max_width, int(h * scale)))
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    b64 = base64.b64encode(buf).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


class AIDetectionService:
    def __init__(self):
        self._model = None

    def _load_model(self):
        if self._model is None:
            from ultralytics import YOLO

            model_path = os.path.join(
                os.path.dirname(__file__), "weights", "yolov8n.pt"
            )
            self._model = YOLO(model_path)

    # ── image helpers ──────────────────────────────────────────────

    def process_frame(self, frame, camera_id=None):
        self._load_model()
        detections = self.detect_signs(frame)
        violations = []
        for det in detections:
            violation = self.create_violation(det, camera_id=camera_id)
            if violation:
                violations.append(violation)
        return violations

    def detect_signs(self, frame):
        """Run YOLO inference and return detections with bounding boxes."""
        self._load_model()
        results = self._model(frame)
        detections = []
        for result in results:
            for box in result.boxes:
                cls_name = result.names[int(box.cls[0])]
                confidence = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append({
                    "label": cls_name,
                    "confidence": confidence,
                    "box": [round(x1), round(y1), round(x2), round(y2)],
                })
        return detections

    def draw_boxes(self, frame, detections):
        """Draw bounding boxes + labels on a copy of the frame."""
        annotated = frame.copy()
        for det in detections:
            bx = det.get("box")
            if not bx:
                continue
            x1, y1, x2, y2 = [int(v) for v in bx]
            color = _color_for(det["label"])
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

            label_text = f"{det['label']} {det['confidence'] * 100:.0f}%"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale, thickness = 0.55, 2
            (tw, th), _ = cv2.getTextSize(label_text, font, font_scale, thickness)
            cv2.rectangle(annotated, (x1, y1 - th - 8), (x1 + tw + 4, y1), color, -1)
            cv2.putText(annotated, label_text, (x1 + 2, y1 - 4),
                        font, font_scale, (255, 255, 255), thickness)
        return annotated

    def detect_vehicle(self, frame):
        return self.detect_signs(frame)

    def create_violation(self, detection, camera_id=None):
        if detection.get("label") not in {"speed_limit", "stop", "traffic light", "no entry"}:
            return None
        camera = Camera.objects.filter(id=camera_id).first() if camera_id else None
        sign = TrafficSign.objects.filter(sign_type__icontains=detection.get("label")).first()
        violation = create_violation_with_fine(
            vehicle=None,
            driver=None,
            sign=sign,
            camera=camera,
            violation_type=detection.get("label"),
            evidence_photo_url="",
            location=camera.location if camera else "",
        )
        AIDetectionLog.objects.create(
            camera=camera,
            detected_object=detection.get("label"),
            confidence_score=detection.get("confidence", 0.0),
            image_url="",
            detected_at=timezone.now(),
            processed=True,
            created_violation=violation,
        )
        return violation

    def extract_frame(self, video_path):
        cap = cv2.VideoCapture(video_path)
        ret, frame = cap.read()
        cap.release()
        if not ret:
            return None
        return frame

    # ── video processing ───────────────────────────────────────────

    def process_video(self, video_path, camera_id=None, sample_interval=1.0,
                      max_frames=120, confidence_threshold=0.35):
        """
        Analyse a video file frame-by-frame.

        Args:
            video_path: filesystem path to the video
            camera_id: optional camera FK
            sample_interval: seconds between sampled frames (default 1 s)
            max_frames: hard cap on frames to analyse
            confidence_threshold: minimum YOLO confidence to keep

        Returns a dict ready for the API response.
        """
        self._load_model()

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {"error": "Cannot open video file"}

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        duration_sec = total_frame_count / fps if fps else 0
        frame_step = max(1, int(fps * sample_interval))

        # accumulators
        all_detections = []       # every detection across all sampled frames
        frame_results = []        # per-frame summary
        violation_objs = []       # DB TrafficViolation instances
        seen_violations = set()   # deduplicate (label, location) combos

        frames_analysed = 0
        frame_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # only analyse sampled frames
            if frame_idx % frame_step != 0:
                frame_idx += 1
                continue

            if frames_analysed >= max_frames:
                break

            timestamp_sec = round(frame_idx / fps, 2)
            detections = self.detect_signs(frame)

            # filter by confidence
            detections = [d for d in detections if d["confidence"] >= confidence_threshold]

            frame_det_items = []
            for det in detections:
                det["timestamp"] = timestamp_sec
                all_detections.append(det)
                frame_det_items.append({
                    "label": det["label"],
                    "confidence": round(det["confidence"] * 100, 1),
                })

                # create violation record (dedup within this upload)
                label = det["label"]
                camera = Camera.objects.filter(id=camera_id).first() if camera_id else None
                dedup_key = (label, camera.location if camera else "")
                if label in {"speed_limit", "stop", "traffic light", "no entry"} and dedup_key not in seen_violations:
                    seen_violations.add(dedup_key)
                    sign = TrafficSign.objects.filter(sign_type__icontains=label).first()

                    # save evidence frame to media/
                    evidence_url = self._save_evidence_frame(frame, label, timestamp_sec)

                    violation = create_violation_with_fine(
                        vehicle=None,
                        driver=None,
                        sign=sign,
                        camera=camera,
                        violation_type=label,
                        evidence_photo_url=evidence_url,
                        location=camera.location if camera else "",
                    )
                    AIDetectionLog.objects.create(
                        camera=camera,
                        detected_object=label,
                        confidence_score=det["confidence"],
                        image_url=evidence_url,
                        detected_at=timezone.now(),
                        processed=True,
                        created_violation=violation,
                    )
                    violation_objs.append(violation)

            if frame_det_items:
                # draw boxes on this frame and encode as thumbnail
                annotated = self.draw_boxes(frame, detections)
                thumb = _frame_to_base64(annotated, max_width=640)
                frame_results.append({
                    "frame": frames_analysed + 1,
                    "timestamp": timestamp_sec,
                    "detections": frame_det_items,
                    "thumbnail": thumb,
                })

            frames_analysed += 1
            frame_idx += 1

        cap.release()

        # ── build response ─────────────────────────────────────────
        # aggregate object counts
        obj_counts = {}
        for d in all_detections:
            lbl = d["label"]
            obj_counts[lbl] = obj_counts.get(lbl, 0) + 1

        detected_objects = sorted(
            [{"label": lbl, "count": cnt,
              "confidence": round(
                  max(d["confidence"] for d in all_detections if d["label"] == lbl) * 100, 1
              )}
             for lbl, cnt in obj_counts.items()],
            key=lambda x: x["count"], reverse=True,
        )

        violations_data = []
        for v in violation_objs:
            fine_amount = None
            try:
                fine_amount = str(v.fine.amount)
            except Exception:
                pass
            violations_data.append({
                "id":          v.id,
                "type":        v.violation_type,
                "severity":    v.severity,
                "status":      v.status,
                "location":    v.location or "Unknown",
                "fine_amount": fine_amount,
            })

        return {
            "violations":       violations_data,
            "detected_objects": detected_objects,
            "total_detections": len(all_detections),
            "frames_analysed":  frames_analysed,
            "video_duration":   round(duration_sec, 1),
            "video_fps":        round(fps, 1),
            "frame_results":    frame_results,
        }

    @staticmethod
    def _save_evidence_frame(frame, label, timestamp):
        """Save a frame as JPEG under media/evidence/ and return its URL path."""
        evidence_dir = os.path.join(settings.MEDIA_ROOT, "evidence")
        os.makedirs(evidence_dir, exist_ok=True)
        filename = f"{label}_{timestamp}s_{uuid.uuid4().hex[:8]}.jpg"
        filepath = os.path.join(evidence_dir, filename)
        cv2.imwrite(filepath, frame)
        return f"{settings.MEDIA_URL}evidence/{filename}"
