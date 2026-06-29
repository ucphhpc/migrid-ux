"""
Helpers for template serving in the development server.
"""

from jinja2 import Environment as JinjaEnv
from jinja2 import PackageLoader


def _autoescape(template_name):
    if template_name is None:
        return False
    if template_name.endswith((".html.jinja")):
        return True
    return False


def load_templates_for_package(package):
    """
    Load the templates for a given package.
    """
    return JinjaEnv(loader=PackageLoader(package), autoescape=_autoescape)
