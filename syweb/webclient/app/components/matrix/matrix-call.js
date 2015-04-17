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

var forAllVideoTracksOnStream = function(s, f) {
    var tracks = s.getVideoTracks();
    for (var i = 0; i < tracks.length; i++) {
        f(tracks[i]);
    }
}

var forAllAudioTracksOnStream = function(s, f) {
    var tracks = s.getAudioTracks();
    for (var i = 0; i < tracks.length; i++) {
        f(tracks[i]);
    }
}

var forAllTracksOnStream = function(s, f) {
    forAllVideoTracksOnStream(s, f);
    forAllAudioTracksOnStream(s, f);
}

angular.module('MatrixCall', [])
.factory('MatrixCall', ['webRtcService', 'matrixService', 'matrixPhoneService', 'modelService', '$rootScope', '$timeout', 
function MatrixCallFactory(webRtcService, matrixService, matrixPhoneService, modelService, $rootScope, $timeout) {

    var MatrixCall = function(room_id) {
        this.room_id = room_id;
        this.call_id = "c" + new Date().getTime();
        this.state = 'fledgling';
        this.didConnect = false;

        // a queue for candidates waiting to go out. We try to amalgamate candidates into a single candidate message where possible
        this.candidateSendQueue = [];
        this.candidateSendTries = 0;

        var self = this;
        $rootScope.$watch(this.getRemoteVideoElement(), function (oldValue, newValue) {
            self.tryPlayRemoteStream();
        });

    }

    MatrixCall.getTurnServer = function() {
        matrixService.getTurnServer().then(function(response) {
            if (response.data.uris) {
                console.log("Got TURN URIs: "+response.data.uris);
                MatrixCall.turnServer = response.data;
                $rootScope.haveTurn = true;
                // re-fetch when we're about to reach the TTL
                $timeout(MatrixCall.getTurnServer, MatrixCall.turnServer.ttl * 1000 * 0.9);
            } else {
                console.log("Got no TURN URIs from HS");
                $rootScope.haveTurn = false;
            }
        }, function(error) {
            console.log("Failed to get TURN URIs");
            MatrixCall.turnServer = {};
            $timeout(MatrixCall.getTurnServer, 60000);
        });
    }

    MatrixCall.CALL_TIMEOUT = 60000;
    MatrixCall.FALLBACK_STUN_SERVER = 'stun:stun.l.google.com:19302';

    MatrixCall.prototype.createPeerConnection = function() {
        var self = this;
        var pc = webRtcService.createPeerConnection(MatrixCall.turnServer);
        if (!pc) return null;
        pc.ngoniceconnectionstatechange = function() { self.onIceConnectionStateChanged(); };
        pc.ngonsignalingstatechange = function() { self.onSignallingStateChanged(); };
        pc.ngonicecandidate = function(c) { self.gotLocalIceCandidate(c); };
        pc.ngonaddstream = function(s) { self.onAddStream(s); };
        return pc;
    }

    MatrixCall.prototype.getUserMediaVideoContraints = function(callType) {
        switch (callType) {
            case 'voice':
                return ({audio: true, video: false});
            case 'video':
                return ({audio: true, video: {
                    mandatory: {
                        minWidth: 640,
                        maxWidth: 640,
                        minHeight: 360,
                        maxHeight: 360,
                    }
                }});
        }
    };

    MatrixCall.prototype.placeVoiceCall = function() {
        this.placeCallWithConstraints(this.getUserMediaVideoContraints('voice'));
        this.type = 'voice';
    };

    MatrixCall.prototype.placeVideoCall = function(config) {
        this.placeCallWithConstraints(this.getUserMediaVideoContraints('video'));
        this.type = 'video';
    };

    MatrixCall.prototype.placeCallWithConstraints = function(constraints) {
        var self = this;
        matrixPhoneService.callPlaced(this);
        webRtcService.getUserMedia(constraints).then(function(s) {
            self.gotUserMediaForInvite(s);
        },
        function(e) {
            self.getUserMediaFailed(e);
        });
        this.state = 'wait_local_media';
        this.direction = 'outbound';
        this.config = constraints;
    };

    MatrixCall.prototype.initWithInvite = function(event) {
        this.msg = event.content;
        this.peerMember = modelService.getMember(event.room_id, event.user_id);
        this.peerConn = this.createPeerConnection();
        var self = this;
        if (this.peerConn) {
            this.peerConn.ngsetRemoteDescription(webRtcService.newRTCSessionDescription(this.msg.offer)).then(
                function(s) {
                    self.onSetRemoteDescriptionSuccess(s);
                },
                function(e) {
                    self.onSetRemoteDescriptionError(e);
                }
            );
        }
        this.state = 'ringing';
        this.direction = 'inbound';

        // This also applied to the Safari OpenWebRTC extension so let's just do this all the time at least for now
        //if (window.mozRTCPeerConnection) {
            // firefox's RTCPeerConnection doesn't add streams until it starts getting media on them
            // so we need to figure out whether a video channel has been offered by ourselves.
            if (this.msg.offer.sdp.indexOf('m=video') > -1) {
                this.type = 'video';
            } else {
                this.type = 'voice';
            }
        //}

        var self = this;
        if (event.age) {
            $timeout(function() {
                if (self.state == 'ringing') {
                    self.state = 'ended';
                    self.hangupParty = 'remote'; // effectively
                    self.stopAllMedia();
                    if (self.peerConn.signalingState != 'closed') self.peerConn.close();
                    if (self.onHangup) self.onHangup(self);
                }
            }, this.msg.lifetime - event.age);
        }
    };

    // perverse as it may seem, sometimes we want to instantiate a call with a hangup message
    // (because when getting the state of the room on load, events come in reverse order and
    // we want to remember that a call has been hung up)
    MatrixCall.prototype.initWithHangup = function(event) {
        this.msg = event.content;
        this.state = 'ended';
    };

    MatrixCall.prototype.answer = function() {
        console.log("Answering call "+this.call_id);

        var self = this;

        var roomMembers = modelService.getRoom(this.room_id).current_room_state.members;
        if (roomMembers[matrixService.config().user_id].event.content.membership != 'join') {
            console.log("We need to join the room before we can accept this call");
            // XXX: what happens if we try to join a remote room based on ID?  Apparently HSes don't
            // know how to locate the participating servers of a room if it's identified purely by ID...
            // XXX: in fact, when does this ever happen?  Surely we need to already be joined to a room
            // in order to have received the event we're answering...
            matrixService.join(this.room_id).then(function() {
                self.answer();
            }, function() {
                console.log("Failed to join room: can't answer call!");
                self.onError("Unable to join room to answer call!");
                self.hangup();
            });
            return;
        }

        if (!this.localAVStream && !this.waitForLocalAVStream) {
            webRtcService.getUserMedia(this.getUserMediaVideoContraints(this.type)).then(function(s) {
                self.gotUserMediaForAnswer(s);
            },
            function(e) {
                self.getUserMediaFailed(e);
            });
            this.state = 'wait_local_media';
        } else if (this.localAVStream) {
            this.gotUserMediaForAnswer(this.localAVStream);
        } else if (this.waitForLocalAVStream) {
            this.state = 'wait_local_media';
        }
    };

    MatrixCall.prototype.stopAllMedia = function() {
        if (this.localAVStream) {
            forAllTracksOnStream(this.localAVStream, function(t) {
                if (t.stop) t.stop();
            });
            // also call stop on the main stream so firefox will stop sharing
            // the mic
            if (this.localAVStream.stop) {
                this.localAVStream.stop();
            }
        }
        if (this.remoteAVStream) {
            forAllTracksOnStream(this.remoteAVStream, function(t) {
                if (t.stop) t.stop();
            });
        }
    };

    MatrixCall.prototype.hangup = function(reason, suppressEvent) {
        console.log("Ending call "+this.call_id);

        // pausing now keeps the last frame (ish) of the video call in the video element
        // rather than it just turning black straight away
        if (this.getRemoteVideoElement() && this.getRemoteVideoElement().pause) this.getRemoteVideoElement().pause();
        if (this.getLocalVideoElement() && this.getLocalVideoElement().pause) this.getLocalVideoElement().pause();

        this.stopAllMedia();
        if (this.peerConn) this.peerConn.close();

        this.hangupParty = 'local';
        this.hangupReason = reason;

        var content = {
            version: 0,
            call_id: this.call_id,
            reason: reason
        };
        this.sendEventWithRetry('m.call.hangup', content);
        this.state = 'ended';
        if (this.onHangup && !suppressEvent) this.onHangup(this);
    };

    MatrixCall.prototype.gotUserMediaForInvite = function(stream) {
        if (this.successor) {
            this.successor.gotUserMediaForAnswer(stream);
            return;
        }
        if (this.state == 'ended') return;

        var videoEl = this.getLocalVideoElement();

        if (videoEl && this.type == 'video') {
            var vidTrack = stream.getVideoTracks()[0];
            videoEl.autoplay = true;
            videoEl.src = URL.createObjectURL(stream);
            videoEl.muted = true;
            var self = this;
            $timeout(function() {
                var vel = self.getLocalVideoElement();
                if (vel.play) vel.play();
            });
        }

        this.localAVStream = stream;
        var audioTracks = stream.getAudioTracks();
        for (var i = 0; i < audioTracks.length; i++) {
            audioTracks[i].enabled = true;
        }
        this.peerConn = this.createPeerConnection();
        this.peerConn.addStream(stream);
        var self = this;
        this.peerConn.ngcreateOffer().then(function(d) {
            self.gotLocalOffer(d);
        }, function(e) {
            self.getLocalOfferFailed(e);
        });
        self.state = 'create_offer';
    };

    MatrixCall.prototype.gotUserMediaForAnswer = function(stream) {
        if (this.state == 'ended') return;

        var localVidEl = this.getLocalVideoElement();

        if (localVidEl && this.type == 'video') {
            localVidEl.autoplay = true;
            var vidTrack = stream.getVideoTracks()[0];
            localVidEl.src = URL.createObjectURL(stream);
            localVidEl.muted = true;
            var self = this;
            $timeout(function() {
                var vel = self.getLocalVideoElement();
                if (vel.play) vel.play();
            });
        }

        this.localAVStream = stream;
        var audioTracks = stream.getAudioTracks();
        for (var i = 0; i < audioTracks.length; i++) {
            audioTracks[i].enabled = true;
        }
        this.peerConn.addStream(stream);
        var self = this;
        var constraints = {
            'mandatory': {
                'OfferToReceiveAudio': true,
                'OfferToReceiveVideo': this.type == 'video'
            },
        };
        this.peerConn.ngcreateAnswer(constraints).then(function(d) { 
            self.createdAnswer(d); 
        });
        self.state = 'create_answer';
    };

    MatrixCall.prototype.gotLocalIceCandidate = function(event) {
        if (event.candidate) {
            console.log("Got local ICE "+event.candidate.sdpMid+" candidate: "+event.candidate.candidate);
            // As with the offer, note we need to make a copy of this object, not pass the original: that broke in Chrome ~m43.
            var c = {
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid,
                sdpMLineIndex: event.candidate.sdpMLineIndex,
            };
            this.sendCandidate(c);
        }
    };

    MatrixCall.prototype.gotRemoteIceCandidate = function(cand) {
        if (this.state == 'ended') {
            //console.log("Ignoring remote ICE candidate because call has ended");
            return;
        }
        console.log("Got remote ICE "+cand.sdpMid+" candidate: "+cand.candidate);
        this.peerConn.addIceCandidate(webRtcService.newIceCandidate(cand), function() {}, function(e) {});
    };

    MatrixCall.prototype.receivedAnswer = function(msg) {
        if (this.state == 'ended') return;

        var self = this;
        this.peerConn.ngsetRemoteDescription(webRtcService.newRTCSessionDescription(msg.answer)).then(
        function(s) {
            self.onSetRemoteDescriptionSuccess(s);
        },
        function(e) {
            self.onSetRemoteDescriptionError(e);
        });
        this.state = 'connecting';
    };


    MatrixCall.prototype.gotLocalOffer = function(description) {
        console.log("Created offer: "+description);

        if (this.state == 'ended') {
            console.log("Ignoring newly created offer on call ID "+this.call_id+" because the call has ended");
            return;
        }

        var self = this;
        this.peerConn.ngsetLocalDescription(description).then(function() {
            var content = {
                version: 0,
                call_id: self.call_id,
                // OpenWebRTC appears to add extra stuff (like the DTLS fingerprint) to the description
                // when setting it on the peerconnection. According to the spec it should only add ICE
                // candidates. Any ICE candidates that have already been generated at this point will
                // probably be sent both in the offer and separately. Ho hum.
                // Also, note that we have to make a new object here, copying the type and sdp properties.
                // Passing the RTCSessionDescription object as-is doesn't work in Chrome (as of about m43).
                offer: { sdp: self.peerConn.localDescription.sdp, type: self.peerConn.localDescription.type },
                lifetime: MatrixCall.CALL_TIMEOUT
            };
            self.sendEventWithRetry('m.call.invite', content);

            $timeout(function() {
                if (self.state == 'invite_sent') {
                    self.hangup('invite_timeout');
                }
            }, MatrixCall.CALL_TIMEOUT);
            self.state = 'invite_sent';
        }, 
        function() { 
            console.log("Error setting local description!"); 
        }
        );
    };

    MatrixCall.prototype.createdAnswer = function(description) {
        console.log("Created answer: "+description);
        var self = this;
        this.peerConn.ngsetLocalDescription(description).then(function() {
            var content = {
                version: 0,
                call_id: self.call_id,
                answer: { sdp: self.peerConn.localDescription.sdp, type: self.peerConn.localDescription.type }
            };
            self.sendEventWithRetry('m.call.answer', content);
            self.state = 'connecting';
        }, function() { console.log("Error setting local description!"); } );
    };

    MatrixCall.prototype.getLocalOfferFailed = function(error) {
        this.onError("Failed to start audio for call!");
    };

    MatrixCall.prototype.getUserMediaFailed = function() {
        this.onError("Couldn't start capturing media! Is your microphone set up and does this app have permission?");
        this.hangup();
    };

    MatrixCall.prototype.onIceConnectionStateChanged = function() {
        if (this.state == 'ended') return; // because ICE can still complete as we're ending the call
        console.log("Ice connection state changed to: "+this.peerConn.iceConnectionState);
        // ideally we'd consider the call to be connected when we get media but chrome doesn't implement nay of the 'onstarted' events yet
        if (this.peerConn.iceConnectionState == 'completed' || this.peerConn.iceConnectionState == 'connected') {
            var self = this;
            self.state = 'connected';
            self.didConnect = true;
        } else if (this.peerConn.iceConnectionState == 'failed') {
            this.hangup('ice_failed');
        }
    };

    MatrixCall.prototype.onSignallingStateChanged = function() {
        console.log("call "+this.call_id+": Signalling state changed to: "+this.peerConn.signalingState);
    };

    MatrixCall.prototype.onSetRemoteDescriptionSuccess = function() {
        console.log("Set remote description");
    };
    
    MatrixCall.prototype.onSetRemoteDescriptionError = function(e) {
        console.log("Failed to set remote description"+e);
    };

    MatrixCall.prototype.onAddStream = function(event) {
        console.log("Stream added"+event);

        var s = event.stream;

        this.remoteAVStream = s;

        if (this.direction == 'inbound') {
            if (s.getVideoTracks().length > 0) {
                this.type = 'video';
            } else {
                this.type = 'voice';
            }
        }

        var self = this;
        forAllTracksOnStream(s, function(t) {
            // not currently implemented in chrome
            t.onstarted = self.onRemoteStreamTrackStarted;
        });

        event.stream.onended = function(e) { self.onRemoteStreamEnded(e); }; 
        // not currently implemented in chrome
        event.stream.onstarted = function(e) { self.onRemoteStreamStarted(e); };

        this.tryPlayRemoteStream();
    };

    MatrixCall.prototype.tryPlayRemoteStream = function(event) {
        if (this.getRemoteVideoElement() && this.remoteAVStream) {
            var player = this.getRemoteVideoElement();
            player.autoplay = true;
            player.src = URL.createObjectURL(this.remoteAVStream);
            var self = this;
            $timeout(function() {
                var vel = self.getRemoteVideoElement();
                if (vel.play) vel.play();
                // OpenWebRTC does not support oniceconnectionstatechange yet
                if (webRtcService.isOpenWebRTC()) self.state = 'connected';
            });
        }
    };

    MatrixCall.prototype.onRemoteStreamStarted = function(event) {
        this.state = 'connected';
    };

    MatrixCall.prototype.onRemoteStreamEnded = function(event) {
        console.log("Remote stream ended");
        this.state = 'ended';
        this.hangupParty = 'remote';
        this.stopAllMedia();
        if (this.peerConn.signalingState != 'closed') this.peerConn.close();
        if (this.onHangup) this.onHangup(this);
    };

    MatrixCall.prototype.onRemoteStreamTrackStarted = function(event) {
        this.state = 'connected';
    };

    MatrixCall.prototype.onHangupReceived = function(msg) {
        console.log("Hangup received");
        if (this.getRemoteVideoElement() && this.getRemoteVideoElement().pause) this.getRemoteVideoElement().pause();
        if (this.getLocalVideoElement() && this.getLocalVideoElement().pause) this.getLocalVideoElement().pause();
        this.state = 'ended';
        this.hangupParty = 'remote';
        this.hangupReason = msg.reason;
        this.stopAllMedia();
        if (this.peerConn && this.peerConn.signalingState != 'closed') this.peerConn.close();
        if (this.onHangup) this.onHangup(this);
    };

    MatrixCall.prototype.onAnsweredElsewhere = function(msg) {
        console.log("Answered elsewhere");
        if (this.getRemoteVideoElement() && this.getRemoteVideoElement().pause) this.getRemoteVideoElement().pause();
        if (this.getLocalVideoElement() && this.getLocalVideoElement().pause) this.getLocalVideoElement().pause();
        this.state = 'ended';
        this.hangupParty = 'remote';
        this.hangupReason = "answered_elsewhere";
        this.stopAllMedia();
        if (this.peerConn && this.peerConn.signalingState != 'closed') this.peerConn.close();
        if (this.onHangup) this.onHangup(this);
    };

    MatrixCall.prototype.replacedBy = function(newCall) {
        console.log(this.call_id+" being replaced by "+newCall.call_id);
        if (this.state == 'wait_local_media') {
            console.log("Telling new call to wait for local media");
            newCall.waitForLocalAVStream = true;
        } else if (this.state == 'create_offer') {
            console.log("Handing local stream to new call");
            newCall.gotUserMediaForAnswer(this.localAVStream);
            delete(this.localAVStream);
        } else if (this.state == 'invite_sent') {
            console.log("Handing local stream to new call");
            newCall.gotUserMediaForAnswer(this.localAVStream);
            delete(this.localAVStream);
        }
        newCall.localVideoSelector = this.localVideoSelector;
        newCall.remoteVideoSelector = this.remoteVideoSelector;
        this.successor = newCall;
        this.hangup(true);
    };

    MatrixCall.prototype.sendEventWithRetry = function(evType, content) {
        var ev = { type:evType, content:content, tries:1 };
        var self = this;
        matrixService.sendEvent(this.room_id, evType, undefined, content).then(this.eventSent, function(error) { self.eventSendFailed(ev, error); } );
    };

    MatrixCall.prototype.eventSent = function() {
    };

    MatrixCall.prototype.eventSendFailed = function(ev, error) {
        if (ev.tries > 5) {
            console.log("Failed to send event of type "+ev.type+" on attempt "+ev.tries+". Giving up.");
            return;
        }
        var delayMs = 500 * Math.pow(2, ev.tries);
        console.log("Failed to send event of type "+ev.type+". Retrying in "+delayMs+"ms");
        ++ev.tries;
        var self = this;
        $timeout(function() {
            matrixService.sendEvent(self.room_id, ev.type, undefined, ev.content).then(self.eventSent, function(error) { self.eventSendFailed(ev, error); } );
        }, delayMs);
    };

    // Sends candidates with are sent in a special way because we try to amalgamate them into one message
    MatrixCall.prototype.sendCandidate = function(content) {
        this.candidateSendQueue.push(content);
        var self = this;
        if (this.candidateSendTries == 0) $timeout(function() { self.sendCandidateQueue(); }, 100);
    };

    MatrixCall.prototype.sendCandidateQueue = function(content) {
        if (this.candidateSendQueue.length == 0) return;

        var cands = this.candidateSendQueue;
        this.candidateSendQueue = [];
        ++this.candidateSendTries;
        var content = {
            version: 0,
            call_id: this.call_id,
            candidates: cands
        };
        var self = this;
        console.log("Attempting to send "+cands.length+" candidates");
        matrixService.sendEvent(self.room_id, 'm.call.candidates', undefined, content).then(function() { self.candsSent(); }, function(error) { self.candsSendFailed(cands, error); } );
    };

    MatrixCall.prototype.candsSent = function() {
        this.candidateSendTries = 0;
        this.sendCandidateQueue();
    };

    MatrixCall.prototype.candsSendFailed = function(cands, error) {
        for (var i = 0; i < cands.length; ++i) {
            this.candidateSendQueue.push(cands[i]);
        }

        if (this.candidateSendTries > 5) {
            console.log("Failed to send candidates on attempt "+this.candidateSendTries+". Giving up for now.");
            this.candidateSendTries = 0;
            return;
        }

        var delayMs = 500 * Math.pow(2, this.candidateSendTries);
        ++this.candidateSendTries;
        console.log("Failed to send candidates. Retrying in "+delayMs+"ms");
        var self = this;
        $timeout(function() {
            self.sendCandidateQueue();
        }, delayMs);
    };

    MatrixCall.prototype.getLocalVideoElement = function() {
        if (this.localVideoSelector) {
            var t = angular.element(this.localVideoSelector);
            if (t.length) return t[0];
        }
        return null;
    };

    MatrixCall.prototype.getRemoteVideoElement = function() {
        if (this.remoteVideoSelector) {
            var t = angular.element(this.remoteVideoSelector);
            if (t.length) return t[0];
        }
        return null;
    };

    return MatrixCall;
}]);
