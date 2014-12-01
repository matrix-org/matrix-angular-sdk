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

angular.module('HomeController', ['matrixService', 'eventHandlerService', 'RecentsController'])
.controller('HomeController', ['$scope', '$location', 'matrixService', 'eventHandlerService', 'recentsService', 'dialogService', '$modal',
                               function($scope, $location, matrixService, eventHandlerService, recentsService, dialogService, $modal) {

    $scope.config = matrixService.config();
    $scope.public_rooms = undefined;
    $scope.newRoomId = "";
    $scope.feedback = "";
    
    $scope.newRoom = {
        room_id: "",
        private: false
    };

    $scope.joinAlias = {
        room_alias: ""
    };
    
    $scope.profile = {
        displayName: "",
        avatarUrl: ""
    };
    
    $scope.newChat = {
        user: ""
    };
    
    recentsService.setSelectedRoomId(undefined);

    var refresh = function() {
        
        matrixService.publicRooms().then(
            function(response) {
                $scope.public_rooms = response.data.chunk;
                for (var i = 0; i < $scope.public_rooms.length; i++) {
                    var room = $scope.public_rooms[i];
                    
                    if (room.aliases && room.aliases.length > 0) {
                        room.room_display_name = room.aliases[0];
                        room.room_alias = room.aliases[0];
                    }
                    else if (room.name) {
                        room.room_display_name = room.name;
                    }
                    else {
                        room.room_display_name = room.room_id;
                    }
                }
            }
        );
    };

    $scope.joinAlias = function(room_alias) {
        eventHandlerService.joinRoom(room_alias).then(function(roomId) {
            $location.url("/room/" + room_alias);
        }, 
        function(err) {
            dialogService.showError(err);
        });
        
    };
    
    // FIXME: factor this out between user-controller and home-controller etc.
    $scope.messageUser = function() {
        // FIXME: create a new room every time, for now
        
        eventHandlerService.createRoom(null, 'private', [$scope.newChat.user]).then(
            function(room_id) { 
                console.log("Created room with id: "+ room_id);
                $location.url("/room/" + room_id);
            },
            function(error) {
                dialogService.showError(error);
            }
        );                
    };
    
    $scope.showCreateRoomDialog = function() {
        var modalInstance = $modal.open({
            templateUrl: 'createRoomTemplate.html',
            controller: 'CreateRoomController',
            size: 'lg',
            scope: $scope
        });
    };
    
 
    $scope.onInit = function() {
        // Load profile data
        // Display name
        matrixService.getDisplayName($scope.config.user_id).then(
            function(response) {
                $scope.profile.displayName = response.data.displayname;
                var config = matrixService.config();
                config.display_name = response.data.displayname;
                matrixService.setConfig(config);
                matrixService.saveConfig();
            },
            function(error) {
                $scope.feedback = "Can't load display name";
            } 
        );
        // Avatar
        matrixService.getProfilePictureUrl($scope.config.user_id).then(
            function(response) {
                $scope.profile.avatarUrl = response.data.avatar_url;
            },
            function(error) {
                $scope.feedback = "Can't load avatar URL";
            } 
        );

        // Listen to room creation event in order to update the public rooms list
        $scope.$on(eventHandlerService.ROOM_CREATE_EVENT, function(ngEvent, event, isLive) {
            if (isLive) {
                // As we do not know if this room is public, do a full list refresh
                refresh();
            }
        });

        refresh();
    };

    // Clean data when user logs out
    $scope.$on(eventHandlerService.RESET_EVENT, function() {
        $scope.public_rooms = [];
    });
}])
.controller('CreateRoomController', ['$scope', '$location', '$modalInstance', 'eventHandlerService', 'dialogService', 
function($scope, $location, $modalInstance, eventHandlerService, dialogService) {
    $scope.newRoom = {
        isPublic: false,
        alias: ""
    };

    $scope.create = function() {
        var isPublic = $scope.newRoom.isPublic ? "public" : "private";
        var alias = $scope.newRoom.alias;
        if (alias.trim().length == 0) {
            alias = undefined;
        }
        if (alias) {
            var colonIndex = alias.indexOf(":");
            if (colonIndex != -1) {
                alias = alias.substr(0, colonIndex);
            }
        }
        eventHandlerService.createRoom(alias, isPublic).then(
            function(roomId) { 
                console.log("Created room with id: "+ roomId);
                $modalInstance.dismiss();
                $location.url("/room/" + roomId);
            },
            function(error) {
                $modalInstance.dismiss();
                dialogService.showError(error);
            }
        );
    };
}]);
