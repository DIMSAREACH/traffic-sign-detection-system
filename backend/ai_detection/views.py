import os
import tempfile

import cv2
from rest_framework import status, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AIDetectionLog, LicensePlateLog
from .serializers import AIDetectionLogSerializer, LicensePlateLogSerializer
from .services import AIDetectionService, _frame_to_base64
from accounts.permissions import AdminDeleteOnly


class AIDetectionLogViewSet(viewsets.ModelViewSet):
    queryset = AIDetectionLog.objects.select_related(
        "camera", "created_violation"
    ).all().order_by("-detected_at")
    serializer_class = AIDetectionLogSerializer
    permission_classes = [IsAuthenticated, AdminDeleteOnly]
    filterset_fields = ["camera", "processed"]
    search_fields = ["detected_object", "camera__name"]
    ordering_fields = ["detected_at", "confidence_score"]


class LicensePlateLogViewSet(viewsets.ModelViewSet):
    queryset = LicensePlateLog.objects.all().order_by("-detected_at")
    serializer_class = LicensePlateLogSerializer
    permission_classes = [IsAuthenticated, AdminDeleteOnly]
    filterset_fields = ["camera"]


class ProcessImageView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        image_file = request.data.get("image")
        camera_id  = request.data.get("camera_id")
        if not image_file:
            return Response({"detail": "Image is required"}, status=status.HTTP_400_BAD_REQUEST)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            for chunk in image_file.chunks():
                tmp.write(chunk)
            temp_path = tmp.name

        try:
            frame   = cv2.imread(temp_path)
            if frame is None:
                return Response({"detail": "Invalid image file"}, status=status.HTTP_400_BAD_REQUEST)

            service = AIDetectionService()

            # raw YOLO detections (all objects, now with bounding boxes)
            detections = service.detect_signs(frame)

            # create DB violation records for matching labels
            violations = service.process_frame(frame, camera_id=camera_id)

            # draw bounding boxes on the image and encode as base64
            annotated_frame = service.draw_boxes(frame, detections)
            annotated_image = _frame_to_base64(annotated_frame, max_width=1280)
            # also send original image as base64 for comparison
            original_image  = _frame_to_base64(frame, max_width=1280)

            # serialise violations with fine info
            violations_data = []
            for v in violations:
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

            # all detected object labels + confidence + bounding boxes
            detected_objects = [
                {
                    "label": d["label"],
                    "confidence": round(d["confidence"] * 100, 1),
                    "box": d.get("box"),
                }
                for d in detections
            ]

            return Response({
                "violations":       violations_data,
                "detected_objects": detected_objects,
                "total_detections": len(detected_objects),
                "annotated_image":  annotated_image,
                "original_image":   original_image,
            }, status=status.HTTP_200_OK)
        finally:
            # clean up temp file
            try:
                os.unlink(temp_path)
            except OSError:
                pass


# ── Accepted video extensions ──
_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".flv"}
_MAX_VIDEO_SIZE = 200 * 1024 * 1024  # 200 MB


class UploadVideoView(APIView):
    """
    Accepts a video upload, performs frame-by-frame YOLO analysis,
    creates violation records, and returns structured results.
    """
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        video_file = request.data.get("video")
        camera_id  = request.data.get("camera_id")
        if not video_file:
            return Response({"detail": "Video is required"},
                            status=status.HTTP_400_BAD_REQUEST)

        # basic validation
        ext = os.path.splitext(video_file.name)[1].lower()
        if ext not in _VIDEO_EXTS:
            return Response(
                {"detail": f"Unsupported video format '{ext}'. Accepted: {', '.join(sorted(_VIDEO_EXTS))}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if video_file.size > _MAX_VIDEO_SIZE:
            return Response(
                {"detail": f"Video exceeds {_MAX_VIDEO_SIZE // (1024*1024)} MB limit."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # write to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            for chunk in video_file.chunks():
                tmp.write(chunk)
            temp_path = tmp.name

        try:
            service = AIDetectionService()
            result = service.process_video(
                video_path=temp_path,
                camera_id=camera_id,
                sample_interval=1.0,
                max_frames=120,
                confidence_threshold=0.35,
            )

            if "error" in result:
                return Response({"detail": result["error"]},
                                status=status.HTTP_400_BAD_REQUEST)

            return Response(result, status=status.HTTP_200_OK)
        finally:
            try:
                os.unlink(temp_path)
            except OSError:
                pass
