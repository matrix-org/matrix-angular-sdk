import os

with open(os.path.join(os.path.dirname(__file__), "webclient/VERSION")) as f:
    __version__ = f.read().strip()
