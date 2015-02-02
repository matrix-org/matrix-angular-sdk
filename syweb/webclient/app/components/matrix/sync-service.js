/*
Copyright 2014 OpenMarket Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

'use strict';

/*
This service manages where in the event stream the web client currently is,
repolling the event stream, and provides methods to resume/pause/stop the event 
stream. This service is not responsible for parsing event data. For that, see 
the eventHandlerService.
*/
// TODO:
// It would be preferable to change the architecture at this point to look more
// like:
// => SyncService --broadcast[room]--> Room object
//      |   +--broadcast[event]-----> Event Handler
//      +----broadcast[user]-------> User object
// which would reduce the amount of gluing that the Event Handler is currently
// doing.
angular.module('syncService', [])
.factory('syncService', ['$q', '$timeout', '$rootScope', 'matrixService', 
'eventHandlerService', function($q, $timeout, $rootScope, matrixService, 
eventHandlerService) {
    var BROADCAST_BAD_CONNECTION = "syncService.BROADCAST_BAD_CONNECTION(isBad)";
    var SERVER_TIMEOUT_MS = 30000;
    var ERR_TIMEOUT_MS = 5000;
    
    var badConnection = false;
    var failedAttempts = 0;
    var MAX_FAILED_ATTEMPTS = 4;
    var MAX_EVENTS = 15;
    
    var settings = {
        from:  undefined,
        filterId: undefined,
        to: undefined,
        limit: undefined,
        shouldPoll: true,
        isActive: false
    };
    
    var setBadConnection = function(isBad) {
        if (badConnection != isBad) {
            badConnection = isBad;
            console.log("[Sync] BROADCAST setBadConnection -> "+isBad);
            $rootScope.$emit(BROADCAST_BAD_CONNECTION, badConnection);
        }
    };
    
    var timeout = $q.defer();
    
    var killConnection = function(reason) {
        console.log("[Sync] killConnection -> "+reason);
        timeout.resolve(reason);
        timeout = $q.defer();
    };
    
    // we need to monitor the specified timeout client-side (SYWEB-219) as we
    // cannot trust that the connection will in fact be ended remotely after 
    // SERVER_TIMEOUT_MS
    var startConnectionTimer = function() {
        return $timeout(function() {
            killConnection("timed out");
        }, SERVER_TIMEOUT_MS + (1000 * 2)); // buffer period
    };
    
    
    // interrupts the stream. Only valid if there is a stream conneciton 
    // open. This is typically used when logging out, to kill the stream 
    // immediately and stop retrying.
    var interrupt = function(shouldPoll) {
        console.log("[Sync] interrupt("+shouldPoll+") "+
                    JSON.stringify(settings));
        settings.shouldPoll = shouldPoll;
        settings.isActive = false;
        killConnection("interrupted");
    };

    var setEventKeys = function(event, room_id, event_id) {
        event.room_id = room_id;
        event.event_id = event_id;
        return event;
    };

    // XXX: horrible compatibility shim to turn v2 events into v1 ones.
    var mangleEvents = function(events) {
        if (!events) return;
        for (var i=0; i<events.length; i++) {
            var event = events[i];
            if (event.sender) {
                event.user_id = event.sender;
                delete event.sender;
            }
            if (event.unsigned && event.unsigned.age) {
                event.age = event.unsigned.age;
                delete event.unsigned.age;
            }
        }
    };

    var doSync = function(deferred) {
        settings.shouldPoll = true;
        settings.isActive = true;
        deferred = deferred || $q.defer();
        
        // monitors if the connection is *still ongoing* after X time then 
        // knifes it as we cannot trust the server side timeout.
        var connTimer = startConnectionTimer(); 
        // monitors if there has been a *successful* response, and if not, says 
        // you're on a bad connection.
        var isLive = settings.from !== undefined;

        // run the stream from the latest token
        matrixService.sync(settings.from, settings.filterId, MAX_EVENTS, 
                           SERVER_TIMEOUT_MS, timeout.promise).then(
            function(response) {
                failedAttempts = 0;
                setBadConnection(false);
                
                $timeout.cancel(connTimer);
                if (!settings.isActive) {
                    console.log("[Sync] Got response but now inactive. "+
                        "Dropping data.");
                    return;
                }
                
                console.log(
                    "[Sync] Got response from "+settings.from+
                    " to "+response.data.next_batch
                );
                
                settings.from = response.data.next_batch;

                // XXX FIXME TODO remap sender -> user_id and unsigned.age to age
				mangleEvents(response.data.private_user_data);
				mangleEvents(response.data.public_user_data);
                if (response.data.rooms) {
    				for (var i=0; i<response.data.rooms.length; i++) {
    					for (var key in response.data.rooms[i].event_map) {
    						if (response.data.rooms[i].event_map.hasOwnProperty(key)) {
    							mangleEvents([response.data.rooms[i].event_map[key]]);
                                setEventKeys(
                                    response.data.rooms[i].event_map[key],
                                    response.data.rooms[i].room_id,
                                    key
                                );
    						}
    					}
    					mangleEvents(response.data.rooms[i].ephemeral);
    				}
                }
                
                eventHandlerService.onSync(response.data, isLive);
                
                deferred.resolve(response);
                
                if (settings.shouldPoll) {
                    $timeout(doSync, 0);
                }
                else {
                    console.log("[Sync] Stopping poll.");
                }
            },
            function(error) {
                console.error("[Sync] failed /events request, retrying...");
                $timeout.cancel(connTimer);
                failedAttempts += 1;
                if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
                    setBadConnection(true);
                }
                
                if (error.status === 403) {
                    settings.shouldPoll = false;
                }
                
                deferred.reject(error);
                
                if (settings.shouldPoll) {
                    $timeout(doSync, ERR_TIMEOUT_MS);
                }
                else {
                    console.log("[Sync] Stopping polling.");
                }
            }
        );

        return deferred.promise;
    };
    
    return {
        // expose these values for testing
        SERVER_TIMEOUT: SERVER_TIMEOUT_MS,
        MAX_FAILED_ATTEMPTS: MAX_FAILED_ATTEMPTS,
        BROADCAST_BAD_CONNECTION: BROADCAST_BAD_CONNECTION,
        MAX_EVENTS: MAX_EVENTS,
    
        // resume the stream from whereever it last got up to. Typically used
        // when the page is opened.
        resume: function() {
            if (settings.isActive) {
                console.log("[Sync] Already active, ignoring resume()");
                return;
            }
        
            console.log("[Sync] resume "+JSON.stringify(settings));
            return doSync();
        },
        
        // pause the stream. Resuming it will continue from the current position
        pause: function() {
            console.log("[Sync] pause "+JSON.stringify(settings));
            // kill any running stream
            interrupt(false);
        },
        
        // stop the stream and wipe the position in the stream. Typically used
        // when logging out / logged out.
        stop: function() {
            console.log("[Sync] stop "+JSON.stringify(settings));
            // kill any running stream
            interrupt(false);
            // clear the latest token
            settings.from = undefined;
        },

        setFilterId: function(filterId) {
            settings.filterId = filterId;
        }
    };

}]);
