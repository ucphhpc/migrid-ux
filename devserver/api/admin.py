"""
Development facing implementation of a admin API.
"""

from types import SimpleNamespace

from flask import request

import devserver.common as server_common
from devserver.common import unconcatify
from migux.apps.admin import TEMPLATE_FOLDER, TEMPLATE_ROUTES

EXAMPLE_DATA = {
    "GET /account_requests": server_common.import_example_data(
        "admin/account_requests.json"
    ),
    "GET /server/logs": server_common.import_example_data(
        "admin/server_logs.json"
    ),
    "GET /server/daemons": server_common.import_example_data(
        "admin/server_daemons.json"
    ),
    "GET /site/stats": server_common.import_example_data(
        "admin/site_stats.json"
    ),
}


def GET_account_requests_summary():
    """
    Request handler: GET /summary
    """

    return {
        "account_requests_count": len(EXAMPLE_DATA["GET /account_requests"]),
    }


def GET_account_requests():
    """
    Request handler: GET /account_requests
    """

    template_route = TEMPLATE_ROUTES["GET /account_requests"]
    request_info = SimpleNamespace(
        args={
            "query": request.values.get("query"),
            "fields": unconcatify(request.values.get("fields", ""), ","),
        },
    )
    example_data = EXAMPLE_DATA["GET /account_requests"]

    return server_common.render_app_template(
        template_route, request_info=request_info, data=example_data
    )


def GET_server_logs():
    """
    Request handler: GET /server/logs
    """

    template_route = TEMPLATE_ROUTES["GET /server/logs"]
    request_info = SimpleNamespace(
        args={
            "count": request.values.get("count"),
        },
    )
    example_data = EXAMPLE_DATA["GET /server/logs"]

    return server_common.render_app_template(
        template_route, request_info=request_info, data=example_data
    )


def GET_server_daemons():
    """
    Request handler: GET /server/daemons
    """

    template_route = TEMPLATE_ROUTES["GET /server/daemons"]
    request_info = SimpleNamespace(args={})
    example_data = EXAMPLE_DATA["GET /server/daemons"]

    return server_common.render_app_template(
        template_route, request_info=request_info, data=example_data
    )


def GET_site_stats():
    """
    Request handler: GET /site/stats
    """

    template_route = TEMPLATE_ROUTES["GET /site/stats"]
    request_info = SimpleNamespace(args={})
    example_data = EXAMPLE_DATA["GET /site/stats"]

    return server_common.render_app_template(
        template_route, request_info=request_info, data=example_data
    )


ROUTES = {
    "GET /account_requests/summary": GET_account_requests_summary,
    "GET /account_requests": GET_account_requests,
    "GET /server/logs": GET_server_logs,
    "GET /server/daemons": GET_server_daemons,
    "GET /site/stats": GET_site_stats,
}

BLUEPRINT = server_common.routes_to_blueprint(
    "admin",
    __name__,
    ROUTES,
    template_folder=TEMPLATE_FOLDER,
)
