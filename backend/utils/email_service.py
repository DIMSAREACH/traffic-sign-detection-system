"""
Transactional email for CamTraffic AI (OTP, security notices).

Uses Django templates under ``templates/emails/`` and ``EmailMultiAlternatives``
for HTML + plain text. SMTP failures are logged and methods return ``False``;
they do not re-raise (callers decide UX).
"""

from __future__ import annotations

import json
import logging
import re

import requests
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

logger = logging.getLogger(__name__)


def _resend_api_error_message(status_code: int, body_text: str) -> str:
    """Turn Resend JSON errors into short, actionable text (no secrets)."""
    try:
        payload = json.loads(body_text)
    except Exception:
        return f"HTTP {status_code}: {body_text[:400]}"
    msg = (payload.get("message") or "").lower()
    if status_code == 403 and "not verified" in msg and "domain" in msg:
        return (
            "The sending domain is not verified in Resend. Open https://resend.com/domains, "
            "add your domain, add the DNS records (e.g. in Cloudflare), and wait until it shows "
            "Verified. For quick local tests only, you can set RESEND_FROM=onboarding@resend.dev "
            "(Resend may restrict which recipients you can use — see Resend documentation)."
        )
    if status_code == 422 and "from" in msg:
        return (
            "Invalid Resend sender address. Set RESEND_FROM to a full address, e.g. "
            "no-reply@yourdomain.com or CamTraffic AI <no-reply@yourdomain.com>."
        )
    return f"HTTP {status_code}: {body_text[:400]}"


def _normalize_resend_from(raw: str) -> tuple[str, str]:
    """
    Resend requires ``from`` like ``email@domain.com`` or ``Name <email@domain.com>``.
    Bare domains (e.g. ``camtraffic.com``) are normalized to ``CamTraffic AI <noreply@domain>``.
    Returns ``(from_header, kind)`` where kind describes the rule used; empty string if unusable.
    """
    s = (raw or "").strip()
    if not s:
        return "", "empty"
    # "Name <email@host>"
    if "<" in s and ">" in s:
        inner = s[s.find("<") + 1 : s.find(">")].strip()
        if re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", inner):
            return s, "display_email"
        return "", "invalid_display"
    if "@" in s:
        if re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", s):
            return s, "plain_email"
        return "", "invalid_email"
    # Bare hostname / domain (no path, no spaces)
    if re.match(
        r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$",
        s,
    ):
        logger.info(
            "RESEND_FROM was set as a bare domain; normalized to noreply@<that-domain> for Resend.",
        )
        return f"CamTraffic AI <noreply@{s}>", "bare_domain"
    return "", "unrecognized"


def _otp_validity_copy(expires_minutes: float, validity_label: str | None) -> str:
    if validity_label:
        return validity_label
    if expires_minutes < 1.0:
        sec = max(1, int(round(expires_minutes * 60)))
        return f"{sec} seconds"
    m = int(expires_minutes)
    if m <= 0:
        return "a short time"
    if m == 1:
        return "1 minute"
    return f"{m} minutes"


def _should_use_resend() -> bool:
    provider = (getattr(settings, "EMAIL_PROVIDER", "auto") or "auto").lower()
    if provider not in {"auto", "resend", "smtp"}:
        provider = "auto"
    if provider == "smtp":
        return False
    # auto/resend: require API key + usable from address (normalized)
    api_key = (getattr(settings, "RESEND_API_KEY", "") or "").strip()
    normalized, _ = _normalize_resend_from(getattr(settings, "RESEND_FROM", "") or "")
    return bool(api_key and normalized)


def _send_via_resend(*, subject: str, html: str, text: str, to_email: str) -> tuple[bool, str]:
    api_key = (getattr(settings, "RESEND_API_KEY", "") or "").strip()
    raw_from = (getattr(settings, "RESEND_FROM", "") or "").strip()
    from_email, _from_kind = _normalize_resend_from(raw_from)
    if not api_key or not from_email:
        return False, "Resend not configured (RESEND_API_KEY/RESEND_FROM missing or invalid)"

    timeout = int(getattr(settings, "EMAIL_TIMEOUT", 10) or 10)
    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"from": from_email, "to": [to_email], "subject": subject, "html": html, "text": text},
            timeout=timeout,
        )
        if 200 <= resp.status_code < 300:
            return True, ""
        return False, _resend_api_error_message(resp.status_code, resp.text or "")
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"


class EmailService:
    """CamTraffic AI outbound mail helpers."""

    @staticmethod
    def send_otp_email(
        user,
        otp_code: str,
        masked_email: str,
        expires_minutes: float = 10.0,
        *,
        to_email: str | None = None,
        validity_label: str | None = None,
    ) -> tuple[bool, str]:
        """
        Send password-reset / verification OTP.

        Subject includes the code per product spec. Plain-text alternative included.
        Returns (success, error_message) — error_message is for DEBUG responses only.
        """
        recipient = (to_email or getattr(user, "email", None) or "").strip()
        if not recipient:
            logger.error("EmailService.send_otp_email: no recipient")
            return False, "No recipient email"

        display_name = (getattr(user, "first_name", None) or "").strip() or getattr(
            user, "username", "there"
        )
        vl = _otp_validity_copy(float(expires_minutes), validity_label)
        year = timezone.now().year
        prefix = getattr(settings, "EMAIL_SUBJECT_PREFIX", "[CamTraffic] ") or ""
        subject = f"{prefix}Your CamTraffic verification code: {otp_code}"

        ctx = {
            "display_name": display_name,
            "otp_code": otp_code,
            "masked_email": masked_email,
            "validity_label": vl,
            "year": year,
            "support_email": getattr(settings, "SUPPORT_CONTACT_EMAIL", ""),
        }

        try:
            html_body = render_to_string("emails/otp_email.html", ctx)
            text_body = render_to_string("emails/otp_email.txt", ctx)
        except Exception as exc:
            logger.exception("EmailService.send_otp_email: template render failed: %s", exc)
            return False, f"{type(exc).__name__}: {exc}"

        if _should_use_resend():
            ok, err = _send_via_resend(
                subject=subject,
                html=html_body,
                text=text_body,
                to_email=recipient,
            )
            if not ok:
                logger.exception("EmailService.send_otp_email: Resend send failed: %s", err)
            return ok, err

        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[recipient],
            )
            msg.attach_alternative(html_body, "text/html")
            msg.send(fail_silently=False)
            return True, ""
        except Exception as exc:
            logger.exception("EmailService.send_otp_email: SMTP send failed: %s", exc)
            return False, f"{type(exc).__name__}: {exc}"

    @staticmethod
    def send_password_reset_link_email(
        user,
        masked_email: str,
        *,
        reset_link_url: str,
        validity_label: str,
        to_email: str | None = None,
    ) -> tuple[bool, str]:
        """Send password-reset magic link (no numeric OTP)."""
        recipient = (to_email or getattr(user, "email", None) or "").strip()
        if not recipient:
            logger.error("EmailService.send_password_reset_link_email: no recipient")
            return False, "No recipient email"

        display_name = (getattr(user, "first_name", None) or "").strip() or getattr(
            user, "username", "there"
        )
        year = timezone.now().year
        prefix = getattr(settings, "EMAIL_SUBJECT_PREFIX", "[CamTraffic] ") or ""
        subject = f"{prefix}Reset your CamTraffic password"

        ctx = {
            "display_name": display_name,
            "masked_email": masked_email,
            "validity_label": validity_label,
            "year": year,
            "support_email": getattr(settings, "SUPPORT_CONTACT_EMAIL", ""),
            "reset_link_url": (reset_link_url or "").strip(),
        }

        try:
            html_body = render_to_string("emails/password_reset_link_email.html", ctx)
            text_body = render_to_string("emails/password_reset_link_email.txt", ctx)
        except Exception as exc:
            logger.exception("EmailService.send_password_reset_link_email: template render failed: %s", exc)
            return False, f"{type(exc).__name__}: {exc}"

        if _should_use_resend():
            ok, err = _send_via_resend(
                subject=subject,
                html=html_body,
                text=text_body,
                to_email=recipient,
            )
            if not ok:
                logger.exception("EmailService.send_password_reset_link_email: Resend send failed: %s", err)
            return ok, err

        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[recipient],
            )
            msg.attach_alternative(html_body, "text/html")
            msg.send(fail_silently=False)
            return True, ""
        except Exception as exc:
            logger.exception("EmailService.send_password_reset_link_email: SMTP send failed: %s", exc)
            return False, f"{type(exc).__name__}: {exc}"

    @staticmethod
    def send_password_changed_email(user) -> bool:
        """Notify user that their password was reset (timestamp in Cambodia ICT)."""
        recipient = (getattr(user, "email", None) or "").strip()
        if not recipient:
            logger.error("EmailService.send_password_changed_email: no recipient")
            return False

        display_name = (getattr(user, "first_name", None) or "").strip() or getattr(
            user, "username", "there"
        )
        dt = timezone.localtime(timezone.now())
        # Cambodia uses ICT (UTC+7); Django TIME_ZONE should be Asia/Phnom_Penh
        changed_at_ict = dt.strftime("%d %B %Y, %H:%M ICT (UTC+7)")
        year = timezone.now().year
        support = getattr(settings, "SUPPORT_CONTACT_EMAIL", "")
        prefix = getattr(settings, "EMAIL_SUBJECT_PREFIX", "[CamTraffic] ") or ""
        subject = f"{prefix}Your CamTraffic AI password was changed"

        ctx = {
            "display_name": display_name,
            "changed_at_ict": changed_at_ict,
            "year": year,
            "support_email": support,
        }

        try:
            html_body = render_to_string("emails/password_changed_email.html", ctx)
            text_body = render_to_string("emails/password_changed_email.txt", ctx)
        except Exception as exc:
            logger.exception(
                "EmailService.send_password_changed_email: template render failed: %s",
                exc,
            )
            return False

        if _should_use_resend():
            ok, err = _send_via_resend(
                subject=subject,
                html=html_body,
                text=text_body,
                to_email=recipient,
            )
            if not ok:
                logger.exception("EmailService.send_password_changed_email: Resend send failed: %s", err)
            return ok

        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[recipient],
            )
            msg.attach_alternative(html_body, "text/html")
            msg.send(fail_silently=False)
            return True
        except Exception as exc:
            logger.exception(
                "EmailService.send_password_changed_email: SMTP send failed: %s",
                exc,
            )
            return False
