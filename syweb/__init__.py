import os

def installed_location():
    return os.path.dirname(__file__)

with open(os.path.join(installed_location(), "webclient/VERSION")) as f:
    __version__ = f.read().strip()
