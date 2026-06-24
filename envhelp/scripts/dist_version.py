#!/usr/bin/env python3

import os
import sys

import semver
import tomlkit

SCRIPT_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, "../.."))
PYPROJECT_FILE = os.path.join(ROOT_DIR, "pyproject.toml")

VERSION_BUMPS = set(("major", "minor", "patch"))


def determine_next_version(version_string, version_bump):
    current_version = semver.Version.parse(version_string)

    bump_fn_name = "bump_%s" % (version_bump,)
    bump_fn = getattr(current_version, bump_fn_name)

    next_version = bump_fn()
    return str(next_version)


class PyProjectFile:
    def __init__(self, pyproject_file_path):
        self.pyproject_file_path = pyproject_file_path
        self._parsed_content = None

    def __enter__(self):
        with open(self.pyproject_file_path, "r") as infile:
            self.pyproject_content = tomlkit.loads(infile.read())
            return self

    def __exit__(self, *args):
        with open(self.pyproject_file_path, "w") as outfile:
            outfile.write(tomlkit.dumps(self.pyproject_content))

    def version_string(self):
        return self.pyproject_content["project"]["version"]

    def update_version_string(self, version_string):
        self.pyproject_content["project"]["version"] = version_string


def operation_bump(thefile, argv):
    if argv[0] not in VERSION_BUMPS:
        print("dist version aborted due to invalid argument", file=sys.stderr)
        return 1

    version_bump = argv[0]
    version_string = thefile.version_string()

    next_version_string = determine_next_version(version_string, version_bump)
    thefile.update_version_string(next_version_string)

    print(thefile.version_string())
    return 0


def operation_show(thefile):
    version_string = thefile.version_string()
    print(thefile.version_string())
    return 0


def main(argv):
    if len(argv) != 1:
        print("dist version aborted due to missing arguments")
        return 1

    if "--show" in argv:
        operation = "show"
    else:
        operation = "bump"

    with PyProjectFile(PYPROJECT_FILE) as thefile:
        if operation == "show":
            return operation_show(thefile)
        if operation == "bump":
            return operation_bump(thefile, argv)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
