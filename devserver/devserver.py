"""
Local server supporting the development of applications.
"""

import os

from flask import Flask
from flask_cors import CORS as cors

from devserver.api.peers import BLUEPRINT as peers
from devserver.templating import load_templates_for_package

SCRIPT_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, ".."))
APPS_DIR = os.path.join(ROOT_DIR, "public", "apps")


def find_apps_on_disk():
    """
    Return a listing of all the apps present in the repository.
    """

    for root, _, files in os.walk(APPS_DIR, followlinks=True):
        relative_dir_name = os.path.relpath(root, start=APPS_DIR)

        for f in files:
            app_name, ext = os.path.splitext(f)
            if ext != ".html":
                continue
            if relative_dir_name == ".":
                yield app_name
            else:
                yield os.path.join(relative_dir_name, app_name)


def create_app():
    """
    Main function defining the devserver for use with flask.
    """

    server_templates = load_templates_for_package(str(__package__))

    app = Flask(__name__)
    cors(app)

    @app.route("/apps")
    def list_apps():
        appnames = find_apps_on_disk()
        fragment = server_templates.get_template("index-apps.html.jinja")
        return fragment.render(appnames=appnames)

    # register any blueprints providing mock APIs here

    app.register_blueprint(peers, url_prefix="/api/peers")

    return app
