"""
Route definitions for migux.apps.peers
"""

import os


class _FieldObjectIterator:
    """
    Allow for-in iteration of a known set of fields of an arbitrary
    listing of similarly strutured result objects.

    At present this is an implementation detail of FieldObjectListing
    and is not meant to be instantiated separately.
    """

    def __init__(self, field_names):
        self._current_field_index = 0
        self._field_object = None
        self._field_names = field_names

    def __getattr__(self, name):
        return self._field_object[name]

    def __iter__(self):
        return self

    def __next__(self):
        if self._current_field_index == len(self._field_names):
            raise StopIteration()
        current_field_name = self._field_names[self._current_field_index]
        try:
            current_field_value = self._field_object[current_field_name]
        except KeyError:
            # the requested field did not existing in the listing object
            current_field_value = ""
        self._current_field_index += 1
        return current_field_value

    def set_field_object(self, field_object):
        """
        Update the iterator with a reference a dictionary
        that will be indexed into on the next iteration.
        """

        self._field_object = field_object
        self._current_field_index = 0
        return self


class FieldObjectListing:
    """
    Wrapper to allow iteration of result object listings which arranges that
    each entry itself is wrapped such that only requested fields are returned.
    """

    def __init__(self, field_objects, field_names):
        self._entry_wrapper = _FieldObjectIterator(field_names)
        self._objects_iterator = iter(field_objects)

    def __iter__(self):
        return self

    def __next__(self):
        return self._entry_wrapper.set_field_object(
            next(self._objects_iterator)
        )


def list_peers_accepted(request, data=None):
    """
    Generate render_info for the listing of accepted peers.
    """

    field_names = request.args.get("fields", [])

    return {
        "template_args": {
            "peers_listing": FieldObjectListing(data, field_names),
        },
        "template_name": "search_result--accepted",
    }


def list_peers_requested(request, data=None):
    """
    Generate render_info for the listing of requested peers.
    """

    field_names = request.args.get("fields", [])

    return {
        "template_args": {
            "peers_listing": FieldObjectListing(data, field_names),
        },
        "template_name": "search_result",
    }


TEMPLATE_FOLDER = os.path.join(os.path.dirname(__file__), "templates")
TEMPLATE_ROUTES = {
    "GET /accepted": {
        "generate_args": list_peers_accepted,
    },
    "GET /requested": {
        "generate_args": list_peers_requested,
    },
}
