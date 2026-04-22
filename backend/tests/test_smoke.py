from django.test import TestCase
from django.conf import settings


class SmokeTest(TestCase):
    def test_settings_loaded(self):
        # Ensure Django settings are available in the test environment
        self.assertIsNotNone(settings.SECRET_KEY)
        self.assertTrue(hasattr(settings, "AUTH_USER_MODEL"))