"""
Development facing implementation of a admin API.
"""

from types import SimpleNamespace

from flask import Blueprint, request

import devserver.common as server_common
from migux.apps.admin import TEMPLATE_FOLDER, TEMPLATE_ROUTES

EXAMPLE_DATA = {
    "GET /logs": server_common.import_example_data("admin/logs.json"),
    "GET /daemons": server_common.import_example_data(
        json_file_name="admin/daemons.json"
    ),
    "GET /stats": server_common.import_example_data("admin/stats.json"),
}


blueprint = Blueprint(
    "admin",
    __name__,
    template_folder=TEMPLATE_FOLDER,
)


@blueprint.get("/logs")
def logs():
    """
    Request handler: GET /logs
    """

    template_route = TEMPLATE_ROUTES["GET /logs"]
    request_info = SimpleNamespace(
        args={
            "last_lines": request.values.get("last_lines"),
        },
    )
    example_data = EXAMPLE_DATA["GET /logs"]

    return server_common.render_app_template(
        template_route, request_info=request_info, data=example_data
    )


@blueprint.get("/daemons")
def daemons():
    """
    Request handler: GET /daemons
    """

    template_route = TEMPLATE_ROUTES["GET /daemons"]
    request_info = SimpleNamespace(args={})
    example_data = EXAMPLE_DATA["GET /daemons"]

    return server_common.render_app_template(
        template_route, request_info=request_info, data=example_data
    )


@blueprint.get("/stats")
def stats():
    """
    Request handler: GET /stats
    """

    template_route = TEMPLATE_ROUTES["GET /stats"]
    request_info = SimpleNamespace(args={})
    example_data = EXAMPLE_DATA["GET /stats"]

    return server_common.render_app_template(
        template_route, request_info=request_info, data=example_data
    )
