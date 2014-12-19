describe('MatrixPhoneService', function() {
    var $rootScope;
    
    // mocked dependencies
    var webRtcService = {
        isWebRTCSupported: function(){}
    };
    
    var matrixService = {
        config: function(){}
    };
    
    var eventHandlerService = {
        CALL_EVENT: "CALL_EVENT"
    };
    
    var MatrixCall = jasmine.createSpy();
        
    beforeEach(function() {
        module(function ($provide) {
            $provide.value('webRtcService', webRtcService);
            $provide.value('matrixService', matrixService);
            $provide.value('eventHandlerService', eventHandlerService);
            $provide.value('MatrixCall', MatrixCall);
        });
        module('matrixPhoneService');
    });
    
    beforeEach(inject(function(_$rootScope_) {
        $rootScope = _$rootScope_;
    }));
    
    it('should listen for CALL_EVENT and be able to create an incoming call', inject(
    function(matrixPhoneService) {
        var userId = "@foo:bar";
        var roomId = "!foo:bar";
        var from = "@alice:bar";
        
        // setup spies
        spyOn(webRtcService, "isWebRTCSupported").and.returnValue(true);
        spyOn(matrixService, "config").and.returnValue({user_id:userId});
        var theCall = {
            initWithInvite: jasmine.createSpy("call.initWithInvite"),
            room_id: roomId
        };
        MatrixCall.and.returnValue(theCall);
        
        // listen for incoming call events
        var broadcastedCall;
        $rootScope.$on(matrixPhoneService.INCOMING_CALL_EVENT, function(ngEvent, c) {
            broadcastedCall = c;
        });
        
        // broadcast incoming event
        var event = {
            content: {
                call_id: "callid",
                lifetime: 1000
            },
            age: 10,
            type: "m.call.invite",
            room_id: roomId,
            user_id: from,
            event_id: "something"
        };
        $rootScope.$broadcast(eventHandlerService.CALL_EVENT, event);
        
        expect(theCall.initWithInvite).toHaveBeenCalledWith(event);
        expect(broadcastedCall).toBe(theCall);
    }));
    
    it('should not create an incoming call if the invite was from yourself', inject(
    function(matrixPhoneService) {
        var userId = "@foo:bar";
        var roomId = "!foo:bar";
        var from = "@alice:bar";
        
        // setup spies
        spyOn(webRtcService, "isWebRTCSupported").and.returnValue(true);
        spyOn(matrixService, "config").and.returnValue({user_id:userId});
        var theCall = {
            initWithInvite: jasmine.createSpy("call.initWithInvite"),
            room_id: roomId
        };
        MatrixCall.and.returnValue(theCall);
        
        // listen for incoming call events
        var broadcastedCall;
        $rootScope.$on(matrixPhoneService.INCOMING_CALL_EVENT, function(ngEvent, c) {
            broadcastedCall = c;
        });
        
        // broadcast incoming event
        var event = {
            content: {
                call_id: "callid",
                lifetime: 1000
            },
            age: 10,
            type: "m.call.invite",
            room_id: roomId,
            user_id: userId,
            event_id: "something"
        };
        $rootScope.$broadcast(eventHandlerService.CALL_EVENT, event);
        
        expect(theCall.initWithInvite).not.toHaveBeenCalled();
        expect(broadcastedCall).toBeUndefined();
    }));
    
    it('should do nothing for expired invites.', inject(
    function(matrixPhoneService) {
        var userId = "@foo:bar";
        var roomId = "!foo:bar";
        var from = "@alice:bar";
        
        // setup spies
        spyOn(webRtcService, "isWebRTCSupported").and.returnValue(true);
        spyOn(matrixService, "config").and.returnValue({user_id:userId});
        var theCall = {
            initWithInvite: jasmine.createSpy("call.initWithInvite"),
            room_id: roomId
        };
        MatrixCall.and.returnValue(theCall);
        
        // listen for incoming call events
        var broadcastedCall;
        $rootScope.$on(matrixPhoneService.INCOMING_CALL_EVENT, function(ngEvent, c) {
            broadcastedCall = c;
        });
        
        // broadcast incoming event
        var event = {
            content: {
                call_id: "callid",
                lifetime: 1000
            },
            age: 777777777,
            type: "m.call.invite",
            room_id: roomId,
            user_id: from,
            event_id: "something"
        };
        $rootScope.$broadcast(eventHandlerService.CALL_EVENT, event);
        
        expect(theCall.initWithInvite).not.toHaveBeenCalled();
        expect(broadcastedCall).toBeUndefined();
    }));
    
    it('should not create a call with the invite if WebRTC is not supported, but should still broadcast the incoming call.', inject(
    function(matrixPhoneService) {
        var userId = "@foo:bar";
        var roomId = "!foo:bar";
        var from = "@alice:bar";
        
        // setup spies
        spyOn(webRtcService, "isWebRTCSupported").and.returnValue(false);
        spyOn(matrixService, "config").and.returnValue({user_id:userId});
        var theCall = {
            initWithInvite: jasmine.createSpy("call.initWithInvite"),
            room_id: roomId
        };
        MatrixCall.and.returnValue(theCall);
        
        // listen for incoming call events
        var broadcastedCall;
        $rootScope.$on(matrixPhoneService.INCOMING_CALL_EVENT, function(ngEvent, c) {
            broadcastedCall = c;
        });
        
        // broadcast incoming event
        var event = {
            content: {
                call_id: "callid",
                lifetime: 1000
            },
            age: 10,
            type: "m.call.invite",
            room_id: roomId,
            user_id: from,
            event_id: "something"
        };
        $rootScope.$broadcast(eventHandlerService.CALL_EVENT, event);
        
        expect(theCall.initWithInvite).not.toHaveBeenCalled();
        expect(broadcastedCall).toBeDefined();
    }));
    
    // TODO: Skipped because we don't check for glare when we place an outgoing call (because if there is an incoming
    //       one then the incoming call UI will be shown and you can't place an outgoing call). It would be nice to handle
    //       this properly though rather than relying on the UI making it impossible to do this.
    xit('should resolve glare via the lowest call ID (by string comparison) (replace incoming call)', inject(
    function(matrixPhoneService) {
        var userId = "@foo:bar";
        var roomId = "!foo:bar";
        var from = "@alice:bar";
        
        // setup spies
        spyOn(webRtcService, "isWebRTCSupported").and.returnValue(true);
        spyOn(matrixService, "config").and.returnValue({user_id:userId});
        var incomingCall = {
            initWithInvite: jasmine.createSpy("call.initWithInvite"),
            receivedAnswer: jasmine.createSpy("call.receivedAnswer"),
            hangup: jasmine.createSpy("call.hangup"),
            room_id: roomId,
            direction: "inbound"
        };
        MatrixCall.and.returnValue(incomingCall);
        
        // broadcast incoming invite event
        var incomingEvent = {
            content: {
                call_id: "ccc1",
                lifetime: 1000
            },
            age: 10,
            type: "m.call.invite",
            room_id: roomId,
            user_id: from,
            event_id: "something"
        };
        $rootScope.$broadcast(eventHandlerService.CALL_EVENT, incomingEvent);
        
        // now do an outgoing call
        var outgoingCall = {
            call_id: "bbb1", // <-- lower call id so it will be saved
            room_id: roomId,
            direction: "outbound",
            state: "invite_sent",
            answer: jasmine.createSpy("call.answer")
        };
        matrixPhoneService.callPlaced(outgoingCall);
        
        expect(incomingCall.hangup).toHaveBeenCalled();
    }));
    
    it('should resolve glare via the lowest call ID (by string comparison) (replace outgoing call)', inject(
    function(matrixPhoneService) {
        var userId = "@foo:bar";
        var roomId = "!foo:bar";
        var from = "@alice:bar";
        
        // setup spies
        spyOn(webRtcService, "isWebRTCSupported").and.returnValue(true);
        spyOn(matrixService, "config").and.returnValue({user_id:userId});
        var incomingCall = {
            initWithInvite: jasmine.createSpy("call.initWithInvite"),
            receivedAnswer: jasmine.createSpy("call.receivedAnswer"),
            replacedBy: jasmine.createSpy("call.replacedBy"),
            answer: jasmine.createSpy("call.answer"),
            room_id: roomId,
            direction: "inbound"
        };
        MatrixCall.and.returnValue(incomingCall);
        
        // listen for replaced call events
        var broadcastedCall;
        $rootScope.$on(matrixPhoneService.REPLACED_CALL_EVENT, function(ngEvent, c) {
            broadcastedCall = c;
        });
        
        // outgoing call
        var outgoingCall = {
            call_id: "ccc",
            room_id: roomId,
            direction: "outbound",
            state: "wait_local_media",
            replacedBy: jasmine.createSpy("call.replacedBy")
        };
        matrixPhoneService.callPlaced(outgoingCall);
        
        // now broadcast incoming invite event
        var incomingEvent = {
            content: {
                call_id: "bbb", // <-- lower call id so it will be saved
                lifetime: 1000
            },
            age: 10,
            type: "m.call.invite",
            room_id: roomId,
            user_id: from,
            event_id: "something"
        };
        $rootScope.$broadcast(eventHandlerService.CALL_EVENT, incomingEvent);
        
        expect(incomingCall.answer).toHaveBeenCalled();
        expect(outgoingCall.replacedBy).toHaveBeenCalledWith(incomingCall);
        expect(broadcastedCall).toBeDefined();
    }));
    
    it('should resolve glare by choosing the incoming call if the outgoing call is in a pre-invite state.', inject(
    function(matrixPhoneService) {
        var userId = "@foo:bar";
        var roomId = "!foo:bar";
        var from = "@alice:bar";
        
        // setup spies
        spyOn(webRtcService, "isWebRTCSupported").and.returnValue(true);
        spyOn(matrixService, "config").and.returnValue({user_id:userId});
        var incomingCall = {
            initWithInvite: jasmine.createSpy("call.initWithInvite"),
            receivedAnswer: jasmine.createSpy("call.receivedAnswer"),
            replacedBy: jasmine.createSpy("call.replacedBy"),
            answer: jasmine.createSpy("call.answer"),
            room_id: roomId,
            direction: "inbound"
        };
        MatrixCall.and.returnValue(incomingCall);
        
        // listen for replaced call events
        var broadcastedCall;
        $rootScope.$on(matrixPhoneService.REPLACED_CALL_EVENT, function(ngEvent, c) {
            broadcastedCall = c;
        });
        
        // outgoing call
        var outgoingCall = {
            call_id: "bbb", // <-- lower call id so would usually be saved...
            room_id: roomId,
            direction: "outbound",
            state: "wait_local_media", // <-------------------- but pre-invite state
            replacedBy: jasmine.createSpy("call.replacedBy")
        };
        matrixPhoneService.callPlaced(outgoingCall);
        
        // now broadcast incoming invite event
        var incomingEvent = {
            content: {
                call_id: "ccc",
                lifetime: 1000
            },
            age: 10,
            type: "m.call.invite",
            room_id: roomId,
            user_id: from,
            event_id: "something"
        };
        $rootScope.$broadcast(eventHandlerService.CALL_EVENT, incomingEvent);
        
        expect(incomingCall.answer).toHaveBeenCalled();
        expect(outgoingCall.replacedBy).toHaveBeenCalledWith(incomingCall);
        expect(broadcastedCall).toBeDefined();
    }));
    
    it('should be able to receive answers and pass it through to the call.', inject(
    function(matrixPhoneService) {
        var userId = "@foo:bar";
        var roomId = "!foo:bar";
        var from = "@alice:bar";
        
        // setup spies
        spyOn(webRtcService, "isWebRTCSupported").and.returnValue(true);
        spyOn(matrixService, "config").and.returnValue({user_id:userId});
        var theCall = {
            initWithInvite: jasmine.createSpy("call.initWithInvite"),
            receivedAnswer: jasmine.createSpy("call.receivedAnswer"),
            room_id: roomId
        };
        MatrixCall.and.returnValue(theCall);
        
        // broadcast incoming invite event
        var event = {
            content: {
                call_id: "callid",
                lifetime: 1000
            },
            age: 10,
            type: "m.call.invite",
            room_id: roomId,
            user_id: from,
            event_id: "something"
        };
        $rootScope.$broadcast(eventHandlerService.CALL_EVENT, event);
        
        // broadcast incoming answer
        event = {
            content: {
                call_id: "callid"
            },
            age: 10,
            type: "m.call.answer",
            room_id: roomId,
            user_id: from,
            event_id: "something2"
        };
        $rootScope.$broadcast(eventHandlerService.CALL_EVENT, event);
        expect(theCall.receivedAnswer).toHaveBeenCalledWith(event.content);
    }));
    
    it('should be able to receive hangups and pass it through to the call.', inject(
    function(matrixPhoneService) {
        var userId = "@foo:bar";
        var roomId = "!foo:bar";
        var from = "@alice:bar";
        
        // setup spies
        spyOn(webRtcService, "isWebRTCSupported").and.returnValue(true);
        spyOn(matrixService, "config").and.returnValue({user_id:userId});
        var theCall = {
            initWithInvite: jasmine.createSpy("call.initWithInvite"),
            onHangupReceived: jasmine.createSpy("call.receivedAnswer"),
            room_id: roomId
        };
        MatrixCall.and.returnValue(theCall);
        
        // broadcast incoming invite event
        var event = {
            content: {
                call_id: "callid",
                lifetime: 1000
            },
            age: 10,
            type: "m.call.invite",
            room_id: roomId,
            user_id: from,
            event_id: "something"
        };
        $rootScope.$broadcast(eventHandlerService.CALL_EVENT, event);
        
        // broadcast incoming hangup
        event = {
            content: {
                call_id: "callid"
            },
            age: 10,
            type: "m.call.hangup",
            room_id: roomId,
            user_id: from,
            event_id: "something2"
        };
        $rootScope.$broadcast(eventHandlerService.CALL_EVENT, event);
        expect(theCall.onHangupReceived).toHaveBeenCalledWith(event.content);
    }));
});
