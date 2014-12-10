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
 * This service wraps calls to web RTC and provides promises for async ops.
 */
angular.module('webRtcService', [])
.service('webRtcService', ['$window', function ($window) {

    var getUserMedia = $window.navigator.getUserMedia || $window.navigator.webkitGetUserMedia || $window.navigator.mozGetUserMedia;
    var rtcPeerConnection = $window.RTCPeerConnection || $window.webkitRTCPeerConnection; // but not mozRTCPeerConnection because its interface is not compatible
    var rtcSessionDescription = $window.RTCSessionDescription || $window.webkitRTCSessionDescription || $window.mozRTCSessionDescription;
    var rtcIceCandidate = $window.RTCIceCandidate || $window.webkitRTCIceCandidate || $window.mozRTCIceCandidate;

    this.isWebRTCSupported = function () {
        return !!(getUserMedia || rtcPeerConnection || rtcSessionDescription ||rtcIceCandidate);
    };

}]);
