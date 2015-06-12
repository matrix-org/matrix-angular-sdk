import os

def installed_location():
    return __file__

with open(os.path.join(os.path.dirname(installed_location()), "webclient/VERSION")) as f:
    __version__ = f.read().strip()
