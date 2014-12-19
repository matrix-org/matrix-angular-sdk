describe('MatrixCall', function() {
    var $q, $timeout, $rootScope;
    
    // webrtc deps
    var testPeerConnection = {
        addStream: function(){},
        close: function(){},
        
        ngsetLocalDescription: function(){},
        ngsetRemoteDescription: function(){},
        ngcreateOffer: function(){},
        ngcreateAnswer: function(){},
        ngsetLocalDescription: function(){}
    };
    
    var testUserMedia = {
        getVideoTracks: function() {
            return [];
        },
        getAudioTracks: function() {
            return [];
        }
    };
    
    // dependencies
    var matrixService = {
        getTurnServer: function(){},
        config: function(){},
        sendEvent: function(){}
    };
    
    var matrixPhoneService = {
        callPlaced: function(){}
    };
    
    var modelService = {
        getRoom: function(){}
    };
    
    var webRtcService = {
        getUserMedia: function(){},
        isWebRTCSupported: function(){},
        isOpenWebRTC: function(){},
        createPeerConnection: function(){},
        newIceCandidate: function(){},
        newRTCSessionDescription: function(){}
    };

    beforeEach(function() {
        // mocked dependencies
        module(function ($provide) {
            $provide.value('matrixService', matrixService);
            $provide.value('matrixPhoneService', matrixPhoneService);
            $provide.value('modelService', modelService);
            $provide.value('webRtcService', webRtcService);
        });
        
        // tested service
        module('MatrixCall');
    });
    
    beforeEach(inject(function(_$q_, _$timeout_, _$rootScope_) {
        $q = _$q_;
        $timeout = _$timeout_;
        $rootScope = _$rootScope_;
    }));
    
    it('should use the TURN servers provided.', inject(
    function(MatrixCall) {
        var turnDefer = $q.defer();
        var turnResponse = {
            password: "pass",
            username: "fwibble",
            ttl: 14234625,
            uris: [
                "turn:uri1?transport=udp",
                "turn:uri2?transport=tcp"
            ]
        };
        spyOn(matrixService, "getTurnServer").and.returnValue(turnDefer.promise);
        
        // do the HTTP hit
        MatrixCall.getTurnServer();
        turnDefer.resolve({data: turnResponse});
        $rootScope.$digest();
        
        // make a call
        var roomId = "!foo:bar";
        var call = new MatrixCall(roomId);
        
        spyOn(webRtcService, "createPeerConnection").and.returnValue(testPeerConnection);
        var offerDefer = $q.defer();
        spyOn(testPeerConnection, "ngcreateOffer").and.returnValue(offerDefer.promise);
        
        var mediaDefer = $q.defer();
        mediaDefer.resolve(testUserMedia);
        spyOn(webRtcService, "getUserMedia").and.returnValue(mediaDefer.promise);
        call.placeVoiceCall();
        $rootScope.$digest();
        
        expect(webRtcService.createPeerConnection).toHaveBeenCalledWith(turnResponse);
        
    }));
    
    it('should be able to receive an incoming call from an invite.', inject(
    function(MatrixCall) {
        var event = {
            content: {
                offer: {
                    type: "offer",
                    sdp: "v=0\r\no=- 6584580628695956864 2 IN IP4 127.0.0.1[...]"
                },
                lifetime: 4252,
                call_id: "2423426452callid"
            },
            age: 1299,
            type: "m.call.invite"
        };
        
        spyOn(webRtcService, "createPeerConnection").and.returnValue(testPeerConnection);
        var remoteDefer = $q.defer();
        spyOn(testPeerConnection, "ngsetRemoteDescription").and.returnValue(remoteDefer.promise);
    
        var roomId = "!foo:bar";
        var call = new MatrixCall(roomId);
        call.call_id = event.content.call_id;
        call.initWithInvite(event);
        expect(webRtcService.createPeerConnection).toHaveBeenCalled();
        
        remoteDefer.resolve({});
        $rootScope.$digest();
        
        expect(call.state).toEqual("ringing");
        expect(call.direction).toEqual("inbound");
    }));
    
    it('should be able to answer an incoming call.', inject(
    function(MatrixCall) {
        var roomId = "!foo:bar";
        var userId = "@user:name";
        
        // setup spies
        spyOn(matrixService, "config").and.returnValue({
            user_id: userId
        });
        spyOn(modelService, "getRoom").and.returnValue({
            room_id: roomId,
            current_room_state: {
                members: {
                    "@user:name": {
                        event: {
                            content: {
                                membership: "join" // already joined the room
                            }
                        }
                    }
                }
            }
        });
        var eventDefer = $q.defer();
        spyOn(matrixService, "sendEvent").and.returnValue(eventDefer.promise);
        var mediaDefer = $q.defer();
        spyOn(webRtcService, "getUserMedia").and.returnValue(mediaDefer.promise);
        spyOn(webRtcService, "createPeerConnection").and.returnValue(testPeerConnection);
        var remoteDefer = $q.defer();
        spyOn(testPeerConnection, "ngsetRemoteDescription").and.returnValue(remoteDefer.promise);
        var createAnswerDefer = $q.defer();
        spyOn(testPeerConnection, "ngcreateAnswer").and.returnValue(createAnswerDefer.promise);
        var localDescDefer = $q.defer(); 
        spyOn(testPeerConnection, "ngsetLocalDescription").and.callFake(function(desc) {
            testPeerConnection.localDescription = desc; // assign it since it may be used later
            return localDescDefer.promise;
        });
        
        // the incoming call
        var event = {
            content: {
                offer: {
                    type: "offer",
                    sdp: "v=0\r\no=- 6584580628695956864 2 IN IP4 127.0.0.1[...]"
                },
                lifetime: 4252,
                call_id: "2423426452callid"
            },
            age: 1299,
            type: "m.call.invite"
        };
        
        // the expected response
        var webRtcAnswer = {
            type: "answer",
            sdp: "v=0\r\no=- 6111111111111114 2 IN IP4 127.0.0.1[...]"
        }
        var answerContent = {
            version: 0,
            call_id: "2423426452callid",
            answer: webRtcAnswer
        };
        
        // recv the call
        var call = new MatrixCall(roomId);
        call.call_id = event.content.call_id;
        call.initWithInvite(event);
        
        // answer the call
        call.answer();
        expect(call.state).toEqual("wait_local_media");
        expect(call.direction).toEqual("inbound");
        
        // grant access to media
        mediaDefer.resolve(testUserMedia);
        $rootScope.$digest();
        expect(call.state).toEqual("create_answer");
        
        // return the answer
        createAnswerDefer.resolve(webRtcAnswer);
        $rootScope.$digest();
        localDescDefer.resolve({});
        $rootScope.$digest();
        expect(call.state).toEqual("connecting");
        
        // technically don't care about the undefined
        expect(matrixService.sendEvent).toHaveBeenCalledWith(roomId, "m.call.answer", undefined, 
        answerContent);
        
        eventDefer.resolve({data:{event_id:"foo"}});
        $rootScope.$digest();
    }));
    
    it('should be able to reject an incoming call.', inject(
    function(MatrixCall) {
        var roomId = "!foo:bar";
        var userId = "@user:name";
        
        // setup spies
        var eventDefer = $q.defer();
        spyOn(matrixService, "sendEvent").and.returnValue(eventDefer.promise);
        var mediaDefer = $q.defer();
        spyOn(webRtcService, "getUserMedia").and.returnValue(mediaDefer.promise);
        spyOn(webRtcService, "createPeerConnection").and.returnValue(testPeerConnection);
        var remoteDefer = $q.defer();
        spyOn(testPeerConnection, "ngsetRemoteDescription").and.returnValue(remoteDefer.promise);
        var createAnswerDefer = $q.defer();
        spyOn(testPeerConnection, "ngcreateAnswer").and.returnValue(createAnswerDefer.promise);
        var localDescDefer = $q.defer(); 
        spyOn(testPeerConnection, "ngsetLocalDescription").and.callFake(function(desc) {
            testPeerConnection.localDescription = desc; // assign it since it may be used later
            return localDescDefer.promise;
        });
        spyOn(testPeerConnection, "close");
        
        // the incoming call
        var event = {
            content: {
                offer: {
                    type: "offer",
                    sdp: "v=0\r\no=- 6584580628695956864 2 IN IP4 127.0.0.1[...]"
                },
                lifetime: 4252,
                call_id: "2423426452callid"
            },
            age: 1299,
            type: "m.call.invite"
        };
        
        // the expected hangup content
        var hangupContent = {
            version: 0,
            call_id: "2423426452callid",
            reason: "some reason"
        };
        
        // recv the call
        var call = new MatrixCall(roomId);
        call.call_id = event.content.call_id;
        call.initWithInvite(event);
        
        // pretend to attach a hangup listener
        call.onHangup = function(){};
        spyOn(call, "onHangup");
        
        // hangup the call
        call.hangup("some reason");
        expect(call.state).toEqual("ended");
        expect(call.direction).toEqual("inbound");
        expect(testPeerConnection.close).toHaveBeenCalled();
        expect(call.onHangup).toHaveBeenCalled();
        
        // technically don't care about the undefined
        expect(matrixService.sendEvent).toHaveBeenCalledWith(roomId, "m.call.hangup", undefined, hangupContent);
    }));
    
    it('should be able to place an outgoing voice call.', inject(
    function(MatrixCall) {
        var roomId = "!foo:bar";
        var userId = "@user:name";
        
        // setup spies
        spyOn(matrixService, "config").and.returnValue({
            user_id: userId
        });
        spyOn(modelService, "getRoom").and.returnValue({
            room_id: roomId,
            current_room_state: {
                members: {
                    "@user:name": {
                        event: {
                            content: {
                                membership: "join" // already joined the room
                            }
                        }
                    }
                }
            }
        });
        var eventDefer = $q.defer();
        spyOn(matrixService, "sendEvent").and.returnValue(eventDefer.promise);
        var mediaDefer = $q.defer();
        spyOn(webRtcService, "getUserMedia").and.returnValue(mediaDefer.promise);
        spyOn(webRtcService, "createPeerConnection").and.returnValue(testPeerConnection);
        var remoteDefer = $q.defer();
        spyOn(testPeerConnection, "ngsetRemoteDescription").and.returnValue(remoteDefer.promise);
        var createOfferDefer = $q.defer();
        spyOn(testPeerConnection, "ngcreateOffer").and.returnValue(createOfferDefer.promise);
        var localDescDefer = $q.defer(); 
        spyOn(testPeerConnection, "ngsetLocalDescription").and.callFake(function(desc) {
            testPeerConnection.localDescription = desc; // assign it since it may be used later
            return localDescDefer.promise;
        });
        
        // the incoming call
        var event = {
            content: {
                offer: {
                    type: "offer",
                    sdp: "v=0\r\no=- 6584580628695956864 2 IN IP4 127.0.0.1[...]"
                },
                lifetime: 4252,
                call_id: "2423426452callid"
            },
            age: 1299,
            type: "m.call.invite"
        };
        
        var webRtcOffer = {
            type: "offer",
            sdp: "v=0\r\no=- 6111111111111114 2 IN IP4 127.0.0.1[...]"
        }
        var offerContent = {
            version: 0,
            offer: webRtcOffer
        };
        
        // place the call
        var call = new MatrixCall(roomId);
        call.placeVoiceCall();
        expect(call.state).toEqual("wait_local_media");
        expect(call.direction).toEqual("outbound");
        
        // allow access to mic
        mediaDefer.resolve(testUserMedia);
        $rootScope.$digest();
        expect(call.state).toEqual("create_offer");
        
        // get the offer
        createOfferDefer.resolve(webRtcOffer);
        $rootScope.$digest();
        localDescDefer.resolve({});
        $rootScope.$digest();
        
        expect(call.state).toEqual("invite_sent");
        expect(matrixService.sendEvent).toHaveBeenCalledWith(roomId, "m.call.invite", undefined, 
        jasmine.objectContaining(offerContent));
    }));
    
    it('should be able to hangup an outgoing call.', inject(
    function(MatrixCall) {
        var roomId = "!foo:bar";
        var userId = "@user:name";
        
        // setup spies
        spyOn(matrixService, "config").and.returnValue({
            user_id: userId
        });
        spyOn(modelService, "getRoom").and.returnValue({
            room_id: roomId,
            current_room_state: {
                members: {
                    "@user:name": {
                        event: {
                            content: {
                                membership: "join" // already joined the room
                            }
                        }
                    }
                }
            }
        });
        var eventDefer = $q.defer();
        spyOn(matrixService, "sendEvent").and.returnValue(eventDefer.promise);
        var mediaDefer = $q.defer();
        spyOn(webRtcService, "getUserMedia").and.returnValue(mediaDefer.promise);
        spyOn(webRtcService, "createPeerConnection").and.returnValue(testPeerConnection);
        var remoteDefer = $q.defer();
        spyOn(testPeerConnection, "ngsetRemoteDescription").and.returnValue(remoteDefer.promise);
        var createOfferDefer = $q.defer();
        spyOn(testPeerConnection, "ngcreateOffer").and.returnValue(createOfferDefer.promise);
        var localDescDefer = $q.defer(); 
        spyOn(testPeerConnection, "ngsetLocalDescription").and.callFake(function(desc) {
            testPeerConnection.localDescription = desc; // assign it since it may be used later
            return localDescDefer.promise;
        });
        spyOn(testPeerConnection, "close");
        
        // the incoming call
        var event = {
            content: {
                offer: {
                    type: "offer",
                    sdp: "v=0\r\no=- 6584580628695956864 2 IN IP4 127.0.0.1[...]"
                },
                lifetime: 4252,
                call_id: "2423426452callid"
            },
            age: 1299,
            type: "m.call.invite"
        };
        
        var webRtcOffer = {
            type: "offer",
            sdp: "v=0\r\no=- 6111111111111114 2 IN IP4 127.0.0.1[...]"
        }
        var offerContent = {
            version: 0,
            offer: webRtcOffer
        };
        var hangupContent = {
            version: 0,
            reason: "a reason"
        };
        
        // place the call
        var call = new MatrixCall(roomId);
        call.placeVoiceCall();
        
        // pretend to attach a hangup listener
        call.onHangup = function(){};
        spyOn(call, "onHangup");
        
        // allow access to mic
        mediaDefer.resolve(testUserMedia);
        $rootScope.$digest();
        
        // get the offer
        createOfferDefer.resolve(webRtcOffer);
        $rootScope.$digest();
        localDescDefer.resolve({});
        $rootScope.$digest();
        
        // hangup
        call.hangup("a reason");
        expect(call.state).toEqual("ended");
        expect(call.direction).toEqual("outbound");
        expect(testPeerConnection.close).toHaveBeenCalled();
        expect(call.onHangup).toHaveBeenCalled();
        
        // technically don't care about the undefined
        expect(matrixService.sendEvent).toHaveBeenCalledWith(roomId, "m.call.hangup", undefined, 
        jasmine.objectContaining(hangupContent));
    }));
});
