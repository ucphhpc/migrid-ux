"""
Common functions used within the dev server and its exposed resources.
"""

import json
import os
import re

from flask import Blueprint, render_template

_SCRIPT_DIR = os.path.dirname(__file__)
_ROUTE_RE = re.compile("^(?P<method>[A-Z]+) (?P<path>.*)")


ROOT_DIR = os.path.normpath(os.path.join(_SCRIPT_DIR, ".."))
DATA_DIR = os.path.join(_SCRIPT_DIR, "data")
APPS_DIR = os.path.join(ROOT_DIR, "public", "apps")


def _break_up_route(route):
    return _ROUTE_RE.match(route).groupdict()


def import_example_data(json_file_name):
    """
    Load a json file containing example data.
    """

    json_file_path = os.path.join(DATA_DIR, json_file_name)

    with open(json_file_path, "r", encoding="utf8") as json_file:
        return json.load(json_file)


def render_app_template(template_route, *, request_info, data):
    """
    Wrapper for executing a template route and rendering the returned
    structure containing the template and arguments to raw output.
    """

    render_info = template_route["generate_args"](request_info, data=data)
    template_render_name = "%s.html.jinja" % (render_info["template_name"],)
    return render_template(template_render_name, **render_info["template_args"])


def routes_to_blueprint(name, import_name, routes, *, template_folder=None):
    """
    Create a blueprint based on a dictionary of routes and handlers.
    """

    bp = Blueprint(name, import_name, template_folder=template_folder)

    for route, route_handler in routes.items():
        route_info = _break_up_route(route)

        wrap = bp.route(route_info["path"], methods=[route_info["method"]])
        wrap(route_handler)

    return bp
