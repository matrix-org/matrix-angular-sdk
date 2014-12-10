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

angular.module('UserController', ['matrixService'])
.controller('UserController', ['$scope', '$rootScope', '$routeParams', 'matrixService', 'dialogService', 'eventHandlerService',
                              function($scope, $rootScope, $routeParams, matrixService, dialogService, eventHandlerService) { 
                              
    $scope.onInit = function() {
        $scope.user = {
            id: $routeParams.user_matrix_id,
            displayname: "",
            avatar_url: undefined
        };
        
        $scope.user_id = matrixService.config().user_id;
        
        matrixService.getDisplayName($scope.user.id).then(
            function(response) {
                $scope.user.displayname = response.data.displayname;
            }
        ); 
        
        matrixService.getProfilePictureUrl($scope.user.id).then(
            function(response) {
                $scope.user.avatar_url = response.data.avatar_url;
            }
        );
    };

    $scope.messageUser = function() {    
        // FIXME: create a new room every time, for now
        eventHandlerService.createRoom(undefined, "private", [$scope.user.id]).then(
            function(room_id) { 
                $scope.feedback = "Invite sent successfully";
                $rootScope.goToPage("/room/" + room_id);
            },
            function(error) {
                dialogService.showError(error);
            });                
    };
    
}]);
