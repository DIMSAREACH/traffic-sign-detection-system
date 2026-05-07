from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.has_role("admin")


class IsOfficerRole(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.has_role("officer")


class IsDriverRole(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.has_role("driver")


class AdminDeleteOnly(BasePermission):
    """DELETE requires admin role; everything else only requires authentication."""
    def has_permission(self, request, view):
        if request.method != "DELETE":
            return True
        return request.user.is_authenticated and request.user.has_role("admin")


class AdminWriteOnly(BasePermission):
    """Safe methods (GET/HEAD/OPTIONS) allowed for any auth'd user.
    All write methods (POST/PUT/PATCH/DELETE) require admin role."""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.has_role("admin")


class IsOfficerOrAdminRole(BasePermission):
    """Allow access to officers and admins."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and (request.user.has_role("officer") or request.user.has_role("admin"))
