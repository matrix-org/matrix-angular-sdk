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

angular.module('RoomController', ['ngSanitize', 'matrixFilter', 'mFileInput'])
.controller('RoomController', ['$modal', '$scope', '$timeout', '$routeParams', '$location', '$rootScope', 'matrixService', 'eventHandlerService', 'mFileUpload', 'MatrixCall', 'modelService', 'recentsService', 'mUserDisplayNameFilter', 'dialogService', 'typingService', 'notificationService',
                               function($modal, $scope, $timeout, $routeParams, $location, $rootScope, matrixService, eventHandlerService, mFileUpload, MatrixCall, modelService, recentsService, mUserDisplayNameFilter, dialogService, typingService, notificationService) {
   'use strict';
    var MESSAGES_PER_PAGINATION = 30;
    var THUMBNAIL_SIZE = 320;
    
    // .html needs this
    $scope.shouldHighlightEvent = notificationService.shouldHighlightEvent;

    // Room ids. Computed and resolved in onInit
    $scope.room_id = undefined;

    $scope.state = {
        user_id: matrixService.config().user_id,
        permission_denied: undefined, // If defined, this string contains the reason why the user cannot join the room
        can_paginate: false, // this is toggled off when we are not ready yet to paginate or when we run out of items
        paginating: false, // used to avoid concurrent pagination requests pulling in dup contents
        messages_visibility: "hidden", // In order to avoid flickering when scrolling down the message table at the page opening, delay the message table display
    };

    $scope.imageURLToSend = "";
    
    // calcs the thumbnail height from a large image
    $scope.thumbHeight = function(fullWidth, fullHeight, boxSize) {
        // boxSize = The bounding box around the image which it will be scaled to.
        if (!fullWidth || !fullHeight) {
            // Cannot calculate thumbnail height for image: missing w/h in metadata. We can't even
            // log this because it's spammy ($digest cycles)
            return undefined;
        }
        if (fullWidth < boxSize && fullHeight < boxSize) {
            // no scaling needs to be applied
            return fullHeight;
        }
        var widthMulti = boxSize / fullWidth;
        var heightMulti = boxSize / fullHeight;
        if (widthMulti < heightMulti) {
            // width is the dominant dimension so scaling will be fixed on that
            return widthMulti * fullHeight;
        }
        else {
            // height is the dominant dimension so scaling will be fixed on that
            return heightMulti * fullHeight;
        }
    };

    // vars and functions for updating the name
    $scope.name = {
        isEditing: false,
        newNameText: "",
        editName: function() {
            if ($scope.name.isEditing) {
                console.log("Warning: Already editing name.");
                return;
            };

            var nameEvent = $scope.room.current_room_state.state_events['m.room.name'];
            if (nameEvent) {
                $scope.name.newNameText = nameEvent.content.name;
            }
            else {
                $scope.name.newNameText = "";
            }

            // Force focus to the input
            $timeout(function() {
                angular.element('.roomNameInput').focus(); 
            }, 0);

            $scope.name.isEditing = true;
        },
        updateName: function() {
            console.log("Updating name to "+$scope.name.newNameText);
            matrixService.setName($scope.room_id, $scope.name.newNameText).then(
                function() {
                },
                function(error) {
                    dialogService.showError(error);
                }
            );

            $scope.name.isEditing = false;
        },
        cancelEdit: function() {
            $scope.name.isEditing = false;
        }
    };

    // vars and functions for updating the topic
    $scope.topic = {
        isEditing: false,
        newTopicText: "",
        editTopic: function() {
            if ($scope.topic.isEditing) {
                console.log("Warning: Already editing topic.");
                return;
            }
            var topicEvent = $scope.room.current_room_state.state_events['m.room.topic'];
            if (topicEvent) {
                $scope.topic.newTopicText = topicEvent.content.topic;
            }
            else {
                $scope.topic.newTopicText = "";
            }
            
            // Force focus to the input
            $timeout(function() {
                angular.element('.roomTopicInput').focus(); 
            }, 0);
            
            $scope.topic.isEditing = true;
        },
        updateTopic: function() {
            console.log("Updating topic to "+$scope.topic.newTopicText);
            matrixService.setTopic($scope.room_id, $scope.topic.newTopicText).then(
                function() {
                },
                function(error) {
                    dialogService.showError(error);
                }
            );

            $scope.topic.isEditing = false;
        },
        cancelEdit: function() {
            $scope.topic.isEditing = false;
        }
    };  
    
    var scrollToBottom = function(force) {
        console.log("Scrolling to bottom");
        
        // Do not autoscroll to the bottom to display the new event if the user is not at the bottom.
        // Exception: in case where the event is from the user, we want to force scroll to the bottom
        var objDiv = document.getElementById("messageTableWrapper");
        if (!objDiv) {
            console.error("No messageTableWrapper found.");
            return;
        }
        // add a 10px buffer to this check so if the message list is not *quite*
        // at the bottom it still scrolls since it basically is at the bottom.
        if ((10 + objDiv.offsetHeight + objDiv.scrollTop >= objDiv.scrollHeight) || force) {
            
            $timeout(function() {
                objDiv.scrollTop = objDiv.scrollHeight;

                // Show the message table once the first scrolldown is done 
                if ("visible" !== $scope.state.messages_visibility) {
                    $timeout(function() {
                        $scope.state.messages_visibility = "visible";
                    }, 0);
                }
            }, 0);
        }
    };

    $scope.$on(modelService.LIVE_MESSAGE_EVENT, function(ngEvent, annotatedEvent) {
        if (annotatedEvent.event.room_id === $scope.room_id) {
            scrollToBottom();
        }
    });
    
    // It is possible for this room to be reaped. If that happens, we need to
    // attach to the NEW room which is created, rather than holding onto the
    // old one.
    $rootScope.$on(modelService.NEW_ROOM, function(ngEvent, newRoom) {
        if (newRoom.room_id === $scope.room_id) {
            $scope.room = newRoom;
        }
    });
    
    $scope.$on(eventHandlerService.MEMBER_EVENT, function(ngEvent, event, isLive) {
        // if there is a live event affecting us
        if (isLive && event.room_id === $scope.room_id && event.state_key === $scope.state.user_id) {
            // if someone else changed our state..
            if (event.user_id !== $scope.state.user_id && "invite" !== event.content.membership && "join" !== event.content.membership) {    
                if ("ban" === event.content.membership) {
                    $scope.state.permission_denied = "You have been banned by " + mUserDisplayNameFilter(event.user_id);
                }
                else {
                    $scope.state.permission_denied = "You have been kicked by " + mUserDisplayNameFilter(event.user_id);
                }  
            }
            else if ("leave" === event.content.membership) {
                $scope.state.permission_denied = "You left the room";
            }
            else {
                scrollToBottom();
            }
        }
    });

    $scope.memberCount = function() {
        return Object.keys($scope.room.now.members).length;
    };
    
    $scope.paginateMore = function() {
        paginate(MESSAGES_PER_PAGINATION);
    };

    var paginate = function(numItems) {
        if ($scope.state.paginating || !$scope.room || !$scope.state.can_paginate) {
            return;
        }
        else {
            $scope.state.paginating = true;
        }
        
        console.log("paginateBackMessages from " + $scope.room.old_room_state.pagination_token + " for " + numItems);
        var originalTopRow = $("#messageTable>tbody>tr:first")[0];
        
        // Paginate events from the point in cache
        matrixService.paginateBackMessages($scope.room_id, $scope.room.old_room_state.pagination_token, numItems).then(
            function(response) {

                eventHandlerService.handleRoomMessages($scope.room_id, response.data, false, 'b');
                if (response.data.chunk.length < MESSAGES_PER_PAGINATION) {
                    // no more messages to paginate. this currently never gets turned true again, as we never
                    // expire paginated contents in the current implementation.
                    $scope.state.can_paginate = false;
                }
                
                $scope.state.paginating = false;
                
                var wrapper = $("#messageTableWrapper")[0];
                var table = $("#messageTable")[0];
                if (!wrapper || !table) {
                    console.error("Cannot find table.");
                    return;
                }
                
                // lock the scroll position
                $timeout(function() {
                    // FIXME: this risks a flicker before the scrollTop is actually updated, but we have to
                    // dispatch it into a function in order to first update the layout.  The right solution
                    // might be to implement it as a directive, more like
                    // http://stackoverflow.com/questions/23736647/how-to-retain-scroll-position-of-ng-repeat-in-angularjs
                    // however, this specific solution breaks because it measures the rows height before
                    // the contents are interpolated.
                    wrapper.scrollTop = originalTopRow ? (originalTopRow.offsetTop + wrapper.scrollTop) : 0;
                }, 0);
                
                // may need multiple paginations to fill the window, so check
                // it again here.
                paginateForWindowSize();
            },
            function(error) {
                console.log("Failed to paginateBackMessages: " + JSON.stringify(error));
                $scope.state.paginating = false;
                if (error.status > 0) {
                    console.error("Stopping pagination due to code "+error.status);
                    $scope.state.can_paginate = false;
                }
            }
        );
    };
    
    var presencePromise = undefined;
    var updatePresenceTimes = function() { 
        if (presencePromise === "$destroy") {
            return;
        }
        $scope.now = new Date().getTime();
        // TODO: don't bother polling every 5s if we know none of our counters are younger than 1 minute
        presencePromise = $timeout(updatePresenceTimes, 5 * 1000); 
    };
    
    $scope.$on("$destroy", function() {
        $timeout.cancel(presencePromise);
        presencePromise = "$destroy";
        $scope.room = null;
    });
    
    $scope.appendName = function($event, annotatedEvent) {
        if ($event.shiftKey) {
            var name = annotatedEvent.sender.name;
            if (!name) {
                name = mUserDisplayNameFilter(annotatedEvent.event.user_id);
            }
            if (name) {
                $('#mainInput').val($('#mainInput').val() + name);
            }
        }
    };

    $scope.send = function() {
        var input = $('#mainInput').val();
        
        if (undefined === input || input === "") {
            return;
        }
        $scope.feedback = "";
        scrollToBottom(true);
        typingService.setTyping($scope.room_id, false);
        
        eventHandlerService.sendMessage($scope.room_id, input,
        {
            onSendEcho: function(echoMessage) {
                $('#mainInput').val('');
            },
            
            onSent: function(response, isEcho) {
                if (!isEcho) { // echos were already cleared
                    $('#mainInput').val('');
                }
            },
            
            onError: function(error) {
                dialogService.showError(error);
            }
        });

        
    };
    
    // Tries to find a suitable room ID for this room.
    $scope.onInit = function() {
        // Extract the room identifier being loaded
        var room_id_or_alias;
        if ($routeParams.room_id_or_alias) { // provided in the url
            room_id_or_alias = decodeURIComponent($routeParams.room_id_or_alias);
        }
        
        if (!room_id_or_alias) {
            // Get the room alias by hand from the URL
            // ie: extract #public:localhost:8080 from http://127.0.0.1:8000/#/room/#public:localhost:8080
            // NB: location.hash is "#/path/here" - We can't split on #s or /s since room aliases could
            // have those, so we'll have to split based on the prefix only.
            if (location.hash.indexOf("#/room/") === 0) {
                room_id_or_alias = decodeURIComponent(
                    location.hash.substring("#/room/".length, location.hash.length)
                );
            }
            else {
                // In case of issue, go to the default page
                console.error("Cannot extract room alias");
                $location.url("/");
                return;
            }
        }
        
        var knownRoom = modelService.getKnownRoom(room_id_or_alias);
        var isJoinedRoom = knownRoom && knownRoom.isJoinedRoom($scope.state.user_id);
        var showJoinDialog = !isJoinedRoom && eventHandlerService.isInitialSyncComplete();
        if (showJoinDialog) {
            dialogService.showProgress("Joining", "Joining room...", 100);
        }
        
        eventHandlerService.joinRoom(room_id_or_alias).then(function(roomId) {
            $scope.room_id = roomId;
            $scope.room = modelService.getRoom($scope.room_id);
            
            // Make recents highlight the current room
            recentsService.setSelectedRoomId($scope.room_id);
            
            updatePresenceTimes();
            
            if (showJoinDialog) {
                $rootScope.$broadcast('dialogs.wait.complete');
            }
            
            // enable pagination on the NEXT digest cycle. If you don't do this,
            // a pagination will be immediately fired because there hasn't been
            // a digest to populate the list from $scope.room.aevents
            $timeout(function() {
                $scope.state.can_paginate = true;
                paginateForWindowSize();
                
                // Scroll down as soon as possible so that we point to the last message
                // if it already exists in memory
                scrollToBottom(true);
            }, 0);
        },
        function(err) {
            if (showJoinDialog) {
                $rootScope.$broadcast('dialogs.wait.complete');
            }
            
            dialogService.showError(err).then(function(r){
                $location.url("/");	
            }, function(r) {
                $location.url("/");	
            });
        });
    };
    
    var paginateForWindowSize = function() {
        // check if we need to pull in more messages to fully populate the
        // window.
        // n.b. we dispatch through a timeout() to allow the digest 
        // to run otherwise the .height methods are stale
        var wrapper = $("#messageTableWrapper")[0];
        var table = $("#messageTable")[0];
        if (!wrapper || !table) {
            console.error("Cannot find table.");
            return;
        }
        
        $timeout(function() {
            if (table.scrollHeight < wrapper.clientHeight) {
                paginate(MESSAGES_PER_PAGINATION);
            }
        }, 0);
    };
    
    $scope.fileToSend;
    $scope.$watch("fileToSend", function(newValue, oldValue) {
        if ($scope.fileToSend) {
            // Upload this file
            var progressAmount = 0;
            dialogService.showProgress("Uploading file...", "", progressAmount);
            mFileUpload.uploadForEvent($scope.fileToSend).then(
                function(fileMessage) {
                    $rootScope.$broadcast('dialogs.wait.complete');
                    $scope.fileToSend = undefined;
                    // fileMessage is complete message structure, send it as is
                    matrixService.sendMessage($scope.room_id, undefined, fileMessage).then(
                        function() {
                            console.log("File message sent");
                        },
                        function(error) {
                            dialogService.showError(error);
                        });
                },
                function(error) {
                    $rootScope.$broadcast('dialogs.wait.complete');
                    console.error("Got : "+JSON.stringify(error));
                    dialogService.showError(error);
                    $scope.fileToSend = undefined;
                },
                function(evt) {
                    progressAmount = 100.0 * (evt.loaded / evt.total);
                    $rootScope.$broadcast('dialogs.wait.progress', {'progress': progressAmount});
                }
            );
        }
    });
    
    $scope.onTyping = function(elem) {
        if ($scope.room) {
            typingService.setTyping($scope.room.room_id, elem[0].value);
        }
    };

    $scope.checkWebRTC = function() {
        if (!$rootScope.isWebRTCSupported()) {
            alert("Your browser does not support WebRTC");
            return false;
        }
        if ($scope.memberCount() != 2) {
            alert("WebRTC calls are currently only supported on rooms with two members");
            return false;
        }
        return true;
    };
    
    $scope.startVoiceCall = function() {        
        if (!$scope.checkWebRTC()) return;

        var call = new MatrixCall($scope.room_id);

        var roomMembers = angular.copy(modelService.getRoom($scope.room_id).current_room_state.members);
        delete roomMembers[matrixService.config().user_id];
        var peer_user_id = Object.keys(roomMembers)[0];
        call.peerMember = modelService.getMember($scope.room_id, peer_user_id);

        call.onError = $rootScope.onCallError;
        call.onHangup = $rootScope.onCallHangup;
        // remote video element is used for playing audio in voice calls
        call.remoteVideoSelector = angular.element('#remoteVideo')[0];
        call.placeVoiceCall();
        $rootScope.currentCall = call;
    };

    $scope.startVideoCall = function() {
        if (!$scope.checkWebRTC()) return;

        var call = new MatrixCall($scope.room_id);

        var roomMembers = angular.copy(modelService.getRoom($scope.room_id).current_room_state.members);
        delete roomMembers[matrixService.config().user_id];
        var peer_user_id = Object.keys(roomMembers)[0];
        call.peerMember = modelService.getMember($scope.room_id, peer_user_id);

        call.onError = $rootScope.onCallError;
        call.onHangup = $rootScope.onCallHangup;
        call.localVideoSelector = '#localVideo';
        call.remoteVideoSelector = '#remoteVideo';
        call.placeVideoCall();
        $rootScope.currentCall = call;
    };

    $scope.openJson = function(annotatedEvent) {
        $scope.event_selected = angular.copy(annotatedEvent);
        
        // scope this so the template can check power levels and enable/disable
        // buttons
        $scope.modelService = modelService;

        var modalInstance = $modal.open({
            templateUrl: 'eventInfoTemplate.html',
            controller: 'EventInfoController',
            scope: $scope
        });

        modalInstance.result.then(function(action) {
            if (action === "redact") {
                var eventId = $scope.event_selected.event.event_id;
                console.log("Redacting event ID " + eventId);
                matrixService.redactEvent(
                    $scope.event_selected.event.room_id,
                    eventId
                ).then(function(response) {
                    console.log("Redaction = " + JSON.stringify(response));
                }, function(error) {
                    console.error("Failed to redact event: "+JSON.stringify(error));
                    dialogService.showError(error);
                });
            }
            else if (action === "resend") {
                // NB: Resend the original, NOT the copy.
                console.log("Resending "+annotatedEvent.event);
                eventHandlerService.resendMessage(annotatedEvent, {
                    onSendEcho: function(echoMessage) {},
                    onSent: function(response, isEcho) {},
                    onError: function(error) {
                        dialogService.showError(error);
                    }
                });
            }
        }, function() {
            // any dismiss code
        });
    };

    $scope.openRoomInfo = function() {
        $scope.roomInfo = {};
        $scope.roomInfo.newEvent = {
            content: {},
            type: "",
            state_key: ""
        };

        var stateEvents = $scope.room.current_room_state.state_events;
        // The modal dialog will 2-way bind this field, so we MUST make a deep
        // copy of the state events else we will be *actually adjusing our view
        // of the world* when fiddling with the JSON!! Apparently parse/stringify
        // is faster than jQuery's extend when doing deep copies.
        $scope.roomInfo.stateEvents = JSON.parse(JSON.stringify(stateEvents));
        var modalInstance = $modal.open({
            templateUrl: 'roomInfoTemplate.html',
            controller: 'RoomInfoController',
            size: 'lg',
            scope: $scope
        });
    };

}])
.controller('EventInfoController', function($scope, $modalInstance) {
    console.log("Displaying modal dialog for >>>> " + JSON.stringify($scope.event_selected));
    $scope.redact = function() {
        console.log("Redact event >> " + JSON.stringify($scope.event_selected));
        $modalInstance.close("redact");
    };
    $scope.resend = function() {
        $modalInstance.close("resend");
    };
    
    $scope.dismiss = $modalInstance.dismiss;
})
.controller('RoomInfoController', function($scope, $location, $modalInstance, matrixService, eventHandlerService, dialogService) {
    console.log("Displaying room info.");
    
    $scope.userIDToInvite = "";
    
    $scope.inviteUser = function() {
        matrixService.invite($scope.room_id, $scope.userIDToInvite).then(
            function() {
                console.log("Invited.");
                dialogService.showSuccess("Invited", "Invite successfully sent to " + $scope.userIDToInvite);
                $scope.userIDToInvite = "";
            },
            function(reason) {
                dialogService.showError(reason);
            });
    };

    $scope.submit = function(event) {
        if (event.content) {
            console.log("submit >>> " + JSON.stringify(event.content));
            matrixService.sendStateEvent($scope.room_id, event.type, 
                event.content, event.state_key).then(function(response) {
                    $modalInstance.dismiss();
                }, function(err) {
                    dialogService.showError(err);
                }
            );
        }
    };
    
    $scope.leaveRoom = function() {
        eventHandlerService.leaveRoom($scope.room_id).then(
            function(response) {
                console.log("Left room " + $scope.room_id);
                $scope.dismiss();
                $location.url("home");
            },
            function(error) {
                dialogService.showError(error);
            }
        );
    };

    $scope.dismiss = $modalInstance.dismiss;

});
