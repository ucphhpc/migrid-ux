"""
Development facing implementation of a admin API.
"""

from types import SimpleNamespace
from typing import Any

from flask import Blueprint, request

import devserver.common as server_common
from devserver.common import (
    create_handler_response,
    make_csrf_token,
    unconcatify,
    validate_csrf_token,
)
from migux.apps.accountreqs import TEMPLATE_FOLDER, TEMPLATE_ROUTES

EXAMPLE_DATA = {
    "GET /": server_common.import_example_data(
        "accountreqs/account_requests.json"
    ),
}


blueprint = Blueprint("accountreqs", __name__, template_folder=TEMPLATE_FOLDER)


def account_requests_of_state(state: str) -> list[dict[str, Any]]:
    """Filters the example data for account requests of a given state."""
    return [
        entry
        for entry in EXAMPLE_DATA["GET /"]
        if entry["account_request_state"] == state
    ]


@blueprint.get("/summary")
def summary():
    """
    Request handler: GET /summary
    """

    return {
        "total": len(EXAMPLE_DATA["GET /"]),
        "requested": len(account_requests_of_state("requested")),
        "pending": len(account_requests_of_state("pending")),
        "accepted": len(account_requests_of_state("accepted")),
    }


@blueprint.get("/csrf_tokens")
def csrf_tokens():
    """
    Request handler: GET /csrf_tokens
    """
    template_route = TEMPLATE_ROUTES["GET /csrf_tokens"]
    request_uri = request.values.get("requests", [])
    request_objects = list(request_uri.split(","))

    csrf_tokens = []
    for request_object in request_objects:
        method_obj, operation_obj = request_object.split("&")
        method = method_obj.split("=")[1]
        operation = operation_obj.split("=")[1]

        token = make_csrf_token(method, operation)
        csrf_tokens.append(
            {"token": token, "method": method, "operation": operation}
        )

    request_info = SimpleNamespace()
    # Generate tokens based on the operation requested
    return server_common.render_app_template(
        template_route, request_info=request_info, data=csrf_tokens
    )


@blueprint.get("")
@blueprint.get("/")
def account_requests():
    """
    Request handler: GET /
    """

    template_route = TEMPLATE_ROUTES["GET /"]
    request_info = SimpleNamespace(
        args={
            "query": request.values.get("query"),
            "state": request.values.get("state"),
            "fields": unconcatify(request.values.get("fields", ""), ","),
        },
    )

    query = request.values.get("query", "").lower()
    example_data = EXAMPLE_DATA["GET /"]
    if state := request.values.get("state"):
        example_data = account_requests_of_state(state)

    def matches_query(entry) -> bool:
        return any(query in str(val).lower() for val in entry.values())

    example_data = filter(matches_query, example_data)

    return server_common.render_app_template(
        template_route, request_info=request_info, data=example_data
    )


@blueprint.post("/reject")
def reject():
    """
    Request handler: POST /accountreqs/reject
    """
    payload = request.json
    expected_token = make_csrf_token("POST", "/accountreqs/reject")

    is_valid, error = validate_csrf_token(payload, expected_token)
    if not is_valid:
        return create_handler_response(403, error=error)

    accreq_ids_to_reject = payload.get("account_request_ids", [])
    if not accreq_ids_to_reject:
        return create_handler_response(
            422, error="No account requests selected for rejecting"
        )

    errors = []
    rejected = []
    for reject_id in accreq_ids_to_reject:
        accreq = next(
            (
                entry
                for entry in EXAMPLE_DATA["GET /"]
                if entry["account_request_id"] == reject_id
            ),
            None,
        )
        if accreq is None:
            errors.append("Account request {!r} not found".format(reject_id))
            continue

        rejected.append(reject_id)

    # remove from exampel data
    EXAMPLE_DATA["GET /"] = [
        entry
        for entry in EXAMPLE_DATA["GET /"]
        if entry["account_request_id"] not in rejected
    ]

    return create_handler_response(
        400 if errors else 200,
        data={"forwarded": rejected, "errors": errors},
    )


@blueprint.post("/forward")
def forward():
    """
    Request handler: POST /accountreqs/forward
    """
    payload = request.json
    expected_token = make_csrf_token("POST", "/accountreqs/forward")

    is_valid, error = validate_csrf_token(payload, expected_token)
    if not is_valid:
        return create_handler_response(403, error=error)

    accreq_ids_to_forward = payload.get("account_request_ids", [])
    if not accreq_ids_to_forward:
        return create_handler_response(
            422, error="No account requests selected for forwarding"
        )

    errors = []
    forwarded = []
    for forward_id in accreq_ids_to_forward:
        accreq = next(
            (
                entry
                for entry in EXAMPLE_DATA["GET /"]
                if entry["account_request_id"] == forward_id
            ),
            None,
        )
        if accreq is None:
            errors.append("Account request {!r} not found".format(forward_id))
            continue

        if accreq["account_request_state"] != "requested":
            errors.append(
                "Account request {!r} is in state {!r}, only 'requested' "
                "account requests can be forwarded".format(
                    forward_id, accreq["account_request_state"]
                )
            )
            continue

        accreq["account_request_state"] = "pending"
        forwarded.append(forward_id)

    return create_handler_response(
        400 if errors else 200,
        data={"forwarded": forwarded, "errors": errors},
    )
