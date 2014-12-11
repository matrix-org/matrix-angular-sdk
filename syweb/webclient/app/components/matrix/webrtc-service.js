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
 * This service wraps calls to web RTC and provides callbacks inside defers (and as a result are $digested).
 */
angular.module('webRtcService', [])
.service('webRtcService', ['$window', '$q', '$rootScope', function ($window, $q, $rootScope) {

    var FALLBACK_STUN_SERVER = 'stun:stun.l.google.com:19302';

    var webRtc = {};
    webRtc.GetUserMedia = $window.navigator.getUserMedia || $window.navigator.webkitGetUserMedia || $window.navigator.mozGetUserMedia;
    webRtc.RtcPeerConnection = $window.RTCPeerConnection || $window.webkitRTCPeerConnection; // but not mozRTCPeerConnection because its interface is not compatible
    webRtc.RtcSessionDescription = $window.RTCSessionDescription || $window.webkitRTCSessionDescription || $window.mozRTCSessionDescription;
    webRtc.RtcIceCandidate = $window.RTCIceCandidate || $window.webkitRTCIceCandidate || $window.mozRTCIceCandidate;

    this.isWebRTCSupported = function () {
        return !!(webRtc.GetUserMedia || webRtc.RtcPeerConnection || webRtc.RtcSessionDescription || webRtc.RtcIceCandidate);
    };
    
    this.isOpenWebRTC = function() {
        var scripts = angular.element('script');
        for (var i = 0; i < scripts.length; i++) {
            if (scripts[i].src.indexOf("owr.js") > -1) {
                return true;
            }
        }
        return false;
    };
    
    /*
     * Creates a new peer connection.
     *
     * @param Object : An object with an Array of 'uris', a 'username' String and a 'password' String
     */
    this.createPeerConnection = function(turnServers) {
        console.log("createPeerConnection: "+JSON.stringify(turnServers));
        var pc;
        if ($window.mozRTCPeerConnection) {
            var iceServers = [];
            // https://github.com/EricssonResearch/openwebrtc/issues/85
            if (turnServers /*&& !webRtcService.isOpenWebRTC()*/) {
                if (turnServers.uris) {
                    for (var i = 0; i < turnServers.uris.length; i++) {
                        iceServers.push({
                            'url': turnServers.uris[i],
                            'username': turnServers.username,
                            'credential': turnServers.password,
                        });
                    }
                } 
                else {
                    console.log("No TURN server: using fallback STUN server");
                    iceServers.push({ 'url' : FALLBACK_STUN_SERVER });
                }
            }
          
            pc = new $window.mozRTCPeerConnection({"iceServers":iceServers});
        } 
        else {
            var iceServers = [];
            // https://github.com/EricssonResearch/openwebrtc/issues/85
            if (turnServers && !this.isOpenWebRTC()) {
                if (turnServers.uris) {
                    iceServers.push({
                        'urls': turnServers.uris,
                        'username': turnServers.username,
                        'credential': turnServers.password,
                    });
                } else {
                    console.log("No TURN server: using fallback STUN server");
                    iceServers.push({ 'urls' : FALLBACK_STUN_SERVER });
                }
            }
            pc = new webRtc.RtcPeerConnection({"iceServers":iceServers});
        }
        
        pc.ngoniceconnectionstatechange = function(){};
        pc.ngonsignalingstatechange = function(){};
        pc.ngonicecandidate = function(){};
        pc.ngonaddstream = function(){};
        
        pc.oniceconnectionstatechange = function() {
            $rootScope.$apply(function() {
                pc.ngoniceconnectionstatechange(); 
            });
        };
        pc.onsignalingstatechange = function() { 
            $rootScope.$apply(function() {
                pc.ngonsignalingstatechange(); 
            });
        };
        pc.onicecandidate = function(c) {
            $rootScope.$apply(function() {
                pc.ngonicecandidate(c); 
            });
        };
        pc.onaddstream = function(s) { 
            $rootScope.$apply(function() {
                pc.ngonaddstream(s); 
            });
        };
        
        pc.ngsetLocalDescription = function(rtcSessionDescription) {
            var defer = $q.defer();
            pc.setLocalDescription(rtcSessionDescription, function(s) {
                defer.resolve(s);
            }, 
            function(e) {
                defer.reject(e);
            });
            return defer.promise;
        }
        
        pc.ngsetRemoteDescription = function(rtcSessionDescription) {
            var defer = $q.defer();
            pc.setRemoteDescription(rtcSessionDescription, function(s) {
                defer.resolve(s);
            }, 
            function(e) {
                defer.reject(e);
            });
            return defer.promise;
        }
        
        pc.ngcreateOffer = function() {
            var defer = $q.defer();
            pc.createOffer(function(s) {
                defer.resolve(s);
            }, 
            function(e) {
                defer.reject(e);
            });
            return defer.promise;
        };
        
        pc.ngcreateAnswer = function(constraints) {
            var defer = $q.defer();
            pc.createAnswer(function(s) {
                defer.resolve(s);
            }, 
            function(e) {
                defer.reject(e);
            }, 
            constraints);
            return defer.promise;
        };
        
        return pc;
    };
    
    this.getUserMedia = function(constraints, fnSuccess, fnFail) {
        console.log("getUserMedia: "+JSON.stringify(constraints));
        var defer = $q.defer();
        
        webRtc.GetUserMedia.call($window.navigator, constraints, function(s) {
            defer.resolve(s);
        }, 
        function(e) {
            defer.reject(e);
        });
        
        return defer.promise;
    };
    
    this.newIceCandidate = function(cand) {
        console.log("newIceCandidate: "+JSON.stringify(cand));
        return new webRtc.RtcIceCandidate(cand);
    };
    
    this.newRTCSessionDescription = function(answer) {
        console.log("newRTCSessionDescription: "+JSON.stringify(answer));
        return new webRtc.RtcSessionDescription(answer);
    };

}]);
