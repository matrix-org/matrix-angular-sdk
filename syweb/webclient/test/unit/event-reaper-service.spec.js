describe('EventReaperService', function() {
    var q, scope;

    // mock dependencies
    var matrixService = {
        roomInitialSync: function(roomId, limit) { 
            return {};
        }
    };
    
    var modelService = {
        removeRoom: function(roomId){},
        getRoom: function(roomId){return {};}
    };
    
    var eventHandlerService = {
        wipeDuplicateDetection: function(roomId) {},
        handleRoomInitialSync: function(room, response) {}
    };
    
    var recentsService = {
        BROADCAST_SELECTED_ROOM_ID: "BROADCAST_SELECTED_ROOM_ID"
    };

    // setup the dependencies
    beforeEach(function() {
    
        // reset test data
        
    
        // dependencies
        module(function ($provide) {
          $provide.value('matrixService', matrixService);
          $provide.value('modelService', modelService);
          $provide.value('recentsService', recentsService);
          $provide.value('eventHandlerService', eventHandlerService);
        });
        
        // tested service
        module('eventReaperService');
    });
    
    beforeEach(inject(function($q, $rootScope) {
        q = $q;
        scope = $rootScope;
    }));

    it('should not reap rooms if it is not enabled.', inject(
    function(eventReaperService) {
        eventReaperService.setEnabled(false);
        
        var roomId = "!reaper:matrix.org";
        
        var event = {
            content: {},
            room_id: roomId,
            event_id: "f",
            type: "m.room.message"
        };
        
        var eventsArray = [event];
        spyOn(modelService, "getRoom").and.callFake(function(roomId) {
            return {
                events: eventsArray
            }
        });
        
        spyOn(matrixService, "roomInitialSync").and.callFake(function() {
            return q.defer().promise;
        });
        
        for (var i=0; i< eventReaperService.MAX_EVENTS + 1; i++) {
            eventsArray.push(event);
            scope.$broadcast(eventHandlerService.MSG_EVENT, event, true);
            scope.$digest();
        }
        
        expect(matrixService.roomInitialSync).not.toHaveBeenCalled();
    }));
    
    it('should be able to force reap a room, even if it is not enabled.', inject(
    function(eventReaperService) {
        eventReaperService.setEnabled(false);
        
        var roomId = "!reaper:matrix.org";
        spyOn(modelService, "removeRoom");
        spyOn(eventHandlerService, "wipeDuplicateDetection");
        spyOn(eventHandlerService, "handleRoomInitialSync");
        spyOn(matrixService, "roomInitialSync").and.callFake(function() {
            var defer = q.defer();
            defer.resolve({
                data: {
                    state: [],
                    messages: [],
                    presence: []
                }
            });
            return defer.promise;
        });
        
        eventReaperService.reap(roomId);
        scope.$digest();
        
        expect(modelService.removeRoom).toHaveBeenCalledWith(roomId);
        expect(eventHandlerService.wipeDuplicateDetection).toHaveBeenCalledWith(roomId);
        expect(eventHandlerService.handleRoomInitialSync).toHaveBeenCalled();
    }));
    
    it('should not reap the room being viewed currently.', inject(
    function(eventReaperService) {
        eventReaperService.setEnabled(true);
        
        var roomId = "!reaper:matrix.org";
        scope.$broadcast(recentsService.BROADCAST_SELECTED_ROOM_ID, roomId);
        scope.$digest();
        
        var event = {
            content: {},
            room_id: roomId,
            event_id: "f",
            type: "m.room.message"
        };
        
        var eventsArray = [event];
        spyOn(modelService, "getRoom").and.callFake(function(roomId) {
            return {
                events: eventsArray
            }
        });
        
        spyOn(matrixService, "roomInitialSync").and.callFake(function() {
            return q.defer().promise;
        });
        
        for (var i=0; i< eventReaperService.MAX_EVENTS + 1; i++) {
            eventsArray.push(event);
            scope.$broadcast(eventHandlerService.MSG_EVENT, event, true);
            scope.$digest();
        }
        
        expect(matrixService.roomInitialSync).not.toHaveBeenCalled();
    }));
    
    it('should reap rooms with more than MAX_EVENTS events.', inject(
    function(eventReaperService) {
        eventReaperService.setEnabled(true);
        
        var roomId = "!reaper:matrix.org";
        scope.$broadcast(recentsService.BROADCAST_SELECTED_ROOM_ID, "!a:b.com");
        scope.$digest();
        
        var aevent = {
            event: {
                content: {},
                room_id: roomId,
                event_id: "f",
                type: "m.room.message"
            }
        };
        
        var aeventsArray = [aevent];
        spyOn(modelService, "getRoom").and.callFake(function(roomId) {
            return {
                aevents: aeventsArray
            }
        });
        
        spyOn(matrixService, "roomInitialSync").and.callFake(function() {
            return q.defer().promise;
        });
        
        for (var i=0; i< eventReaperService.MAX_EVENTS + 1; i++) {
            aeventsArray.push(aevent);
            scope.$broadcast(eventHandlerService.MSG_EVENT, aevent.event, true);
            scope.$digest();
        }
        
        expect(matrixService.roomInitialSync).toHaveBeenCalled();
    }));

    it('should not reap a room whilst a reap of that room is ongoing.', inject(
    function(eventReaperService) {
        var roomId = "!foo:bar";
        spyOn(matrixService, "roomInitialSync").and.callFake(function() {
            return q.defer().promise;
        });

        eventReaperService.reap(roomId);
        expect(matrixService.roomInitialSync).toHaveBeenCalled();
        eventReaperService.reap(roomId);
        expect(matrixService.roomInitialSync.calls.count()).toEqual(1);
    }));
});
