"""
Plugin package CLI that provides an overview of its contents.
"""

import sys

import migux


def main(_):
    """
    Main function for CLI.
    """

    print("`%s` plugin for MiGrid" % (migux.MIG_PLUGIN,))
    print("")
    print("template packages:")
    print(*("- %s" % (pkg,) for pkg in migux.TEMPLATE_PACKAGES), "\n")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
