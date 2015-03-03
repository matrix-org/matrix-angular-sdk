Matrix Angular SDK 
==================

.. image:: http://matrix.org/jenkins/buildStatus/icon?job=SynapseWebClient
   :target: http://matrix.org/jenkins/job/SynapseWebClient/

This project provides AngularJS services for implementing the `Client-Server API`_
on Matrix_ : an open standard for interoperable Instant Messaging and VoIP. It 
comes shipped with Synapse_ : a home server reference implementation.

This project also provides a complete, stand-alone client which can communicate 
with Matrix home servers using a web browser.

The Synapse_ homeserver ships the latest stable version of this library.  If you
wish it to serve up a development copy instead, then you must configure this
checkout to be picked up by synapse::

    $ python setup.py develop --user

Running
=======
To run the stand-alone client, the ``syweb/webclient`` folder must be hosted.
This can most easily be achieved by::

   cd syweb/webclient
   python -m SimpleHTTPServer
   
Navigate to ``http://localhost:8000`` to see the client.

Overview
========
The ``app`` directory contains the SDK, which is split up into subfolders depending
on the logical scope of the code. The ``components`` directory contains reusable
components which are used in many places. More specific directories such as ``home``
and ``settings`` contain code specific to that part of the app: e.g. the home screen
and settings page respectively.

The `Client-Server API`_ is encapsulated as an AngularJS service called ``matrixService``.
There are also complementary services such as ``eventStreamService`` which handle more
complex non-HTTP client logic.

Usage
=====
Services can be used independently provided their dependencies are satisfied. 

* ``matrixService`` is provided at the lowest level, as it just wraps the raw HTTP calls.
* ``modelService`` allows models of matrix objects to be accessed, such as ``User``, 
  ``Room``, ``RoomState`` and ``RoomMember``, and provides convenience functions to perform
  HTTP calls on these objects (e.g. ``Room.leave``).
* ``eventHandlerService`` interprets raw Matrix events and determines what needs to be
  stored with the ``modelService``.
* ``eventStreamService`` controls long-polling behaviour on the ``/events`` HTTP call.
* ``typingService`` controls the submission of typing events into a room.
* ``presenceService`` controls the submission of presence events.
 
Alternatively, you can use different controllers and html templates and leave the services
to work together as is.

Tests
=====
Tests are contained in the `test directory`_. They require
Karma (running PhantomJS) and Jasmine 2.x+ in order to run. Assuming you have the 
required karma plugins, you can run the tests by running ``karma start`` in the 
test directory.

Attributions
============
File icons are taken from http://medialoot.com/item/free-flat-filetype-icons/ and
distributed under the terms of the Paid License (invoice #7355)

Keyboard and GIF icon from icons8: http://icons8.com/

.. _Synapse: https://github.com/matrix-org/synapse/
.. _Matrix: http://www.matrix.org
.. _Client-Server API: http://matrix.org/docs/api/client-server/
.. _test directory: syweb/webclient/test
