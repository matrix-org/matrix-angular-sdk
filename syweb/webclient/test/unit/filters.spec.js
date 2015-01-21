describe('mRoomName filter', function() {
    var filter, mRoomName, mUserDisplayName;
    
    var roomId = "!weufhewifu:matrix.org";
    
    // test state values (f.e. test)
    var testUserId, testAlias, testDisplayName, testOtherDisplayName, testRoomState;
    
    // mocked services which return the test values above.
    var matrixService = {
        config: function() {
            return {
                user_id: testUserId
            };
        }
    };
    
    var modelService = {
        getRoom: function(room_id) {
            return {
                current_room_state: testRoomState
            };
        },
        
        getRoomIdToAliasMapping: function(room_id) {
            return testAlias;
        },
    };
    
    beforeEach(function() {
        // inject mocked dependencies
        module(function ($provide) {
            $provide.value('matrixService', matrixService);
            $provide.value('modelService', modelService);
        });
        
        module('matrixFilter');
        
        // angular resolves dependencies with the same name via a 'last wins'
        // rule, hence we need to have this mock filter impl AFTER module('matrixFilter')
        // so it clobbers the actual mUserDisplayName implementation.
        module(function ($filterProvider) {
            // provide a fake filter
            $filterProvider.register('mUserDisplayName', function() {
                return function(user_id, room_id) {
                    if (user_id === testUserId) {
                        return testDisplayName;
                    }
                    return testOtherDisplayName;
                };
            });
        });
    });
    
    
    beforeEach(inject(function($filter) {
        filter = $filter;
        mRoomName = filter("mRoomName");
        
        // purge the previous test values
        testUserId = undefined;
        testAlias = undefined;
        testDisplayName = undefined;
        testOtherDisplayName = undefined;
        
        // mock up a stub room state
        testRoomState = {
            s:{}, // internal; stores the state events
            state: function(type, key) {
                // accessor used by filter
                return key ? this.s[type+key] : this.s[type];
            },
            members: {}, // struct used by filter
            
            // test helper methods
            setJoinRule: function(rule) {
                this.s["m.room.join_rules"] = {
                    content: {
                        join_rule: rule
                    }
                };
            },
            setRoomName: function(name) {
                this.s["m.room.name"] = {
                    content: {
                        name: name
                    }
                };
            },
            setMember: function(user_id, membership, inviter_user_id) {
                if (!inviter_user_id) {
                    inviter_user_id = user_id;
                }
                this.s["m.room.member" + user_id] = {
                    event: {
                        content: {
                            membership: membership
                        },
                        state_key: user_id,
                        user_id: inviter_user_id 
                    }
                };
                this.members[user_id] = this.s["m.room.member" + user_id];
            }
        };
    }));
    
    /**** ROOM NAME ****/
    
    it("should show the room name if one exists for private (invite join_rules) rooms.", function() {
        var roomName = "The Room Name";
        testUserId = "@me:matrix.org";
        testRoomState.setJoinRule("invite");
        testRoomState.setRoomName(roomName);
        testRoomState.setMember(testUserId, "join");
        var output = mRoomName(roomId);
        expect(output).toEqual(roomName);
    });
    
    it("should show the room name if one exists for public (public join_rules) rooms.", function() {
        var roomName = "The Room Name";
        testUserId = "@me:matrix.org";
        testRoomState.setJoinRule("public");
        testRoomState.setRoomName(roomName);
        testRoomState.setMember(testUserId, "join");
        var output = mRoomName(roomId);
        expect(output).toEqual(roomName);
    });
    
    /**** ROOM ALIAS ****/
    
    it("should show the room alias if one exists for private (invite join_rules) rooms if a room name doesn't exist.", function() {
        testAlias = "#thealias:matrix.org";
        testUserId = "@me:matrix.org";
        testRoomState.setJoinRule("invite");
        testRoomState.setMember(testUserId, "join");
        var output = mRoomName(roomId);
        expect(output).toEqual(testAlias);
    });
    
    it("should show the room alias if one exists for public (public join_rules) rooms if a room name doesn't exist.", function() {
        testAlias = "#thealias:matrix.org";
        testUserId = "@me:matrix.org";
        testRoomState.setJoinRule("public");
        testRoomState.setMember(testUserId, "join");
        var output = mRoomName(roomId);
        expect(output).toEqual(testAlias);
    });
    
    /**** GROUP CHAT ****/
    
    it("should show the names of members in a private (invite join_rules)  room if a room name and alias don't exist and there are >2 members.", function() {
        testUserId = "@me:matrix.org";
        testRoomState.setJoinRule("public");
        testRoomState.setMember(testUserId, "join");
        testRoomState.setMember("@alice:matrix.org", "join");
        testRoomState.setMember("@bob:matrix.org", "join");
        var output = mRoomName(roomId);
        expect(output).toEqual("(2) @alice:matrix.org, @bob:matrix.org");
    });
    
    it("should show the names of members in a public (public join_rules)  room if a room name and alias don't exist and there are >2 members.", function() {
        testUserId = "@me:matrix.org";
        testRoomState.setJoinRule("public");
        testRoomState.setMember(testUserId, "join");
        testRoomState.setMember("@alice:matrix.org", "join");
        testRoomState.setMember("@bob:matrix.org", "join");
        var output = mRoomName(roomId);
        expect(output).toEqual("(2) @alice:matrix.org, @bob:matrix.org");
    });
    
    /**** SELF-CHAT ****/
    
    it("should show your display name for private (invite join_rules) rooms if a room name and alias don't exist and it is a self-chat.", function() {
        testUserId = "@me:matrix.org";
        testDisplayName = "Me";
        testRoomState.setJoinRule("private");
        testRoomState.setMember(testUserId, "join");
        var output = mRoomName(roomId);
        expect(output).toEqual(testDisplayName);
    });
    
    it("should show your user ID for private (invite join_rules) rooms if a room name and alias don't exist and it is a self-chat and they don't have a display name set.", function() {
        testUserId = "@me:matrix.org";
        testRoomState.setJoinRule("private");
        testRoomState.setMember(testUserId, "join");
        var output = mRoomName(roomId);
        expect(output).toEqual(testUserId);
    });
    
    it("should show your user ID for public (public join_rules) rooms if a room name and alias don't exist and it is a self-chat and they don't have a display name set.", function() {
        testUserId = "@me:matrix.org";
        testRoomState.setJoinRule("public");
        testRoomState.setMember(testUserId, "join");
        var output = mRoomName(roomId);
        expect(output).toEqual(testUserId);
    });
    
    /**** ONE-TO-ONE CHAT ****/
    
    it("should show the other user's display name for private (invite join_rules) rooms if a room name and alias don't exist and it is a 1:1-chat.", function() {
        testUserId = "@me:matrix.org";
        otherUserId = "@alice:matrix.org";
        testOtherDisplayName = "Alice";
        testRoomState.setJoinRule("private");
        testRoomState.setMember(testUserId, "join");
        testRoomState.setMember("@alice:matrix.org", "join");
        var output = mRoomName(roomId);
        expect(output).toEqual(testOtherDisplayName);
    });
    
    it("should show the other user's ID for private (invite join_rules) rooms if a room name and alias don't exist and it is a 1:1-chat and they don't have a display name set.", function() {
        testUserId = "@me:matrix.org";
        otherUserId = "@alice:matrix.org";
        testRoomState.setJoinRule("private");
        testRoomState.setMember(testUserId, "join");
        testRoomState.setMember("@alice:matrix.org", "join");
        var output = mRoomName(roomId);
        expect(output).toEqual(otherUserId);
    });
    
    it("should show the other user's ID for public (public join_rules) rooms if a room name and alias don't exist and it is a 1:1-chat and they don't have a display name set.", function() {
        testUserId = "@me:matrix.org";
        otherUserId = "@alice:matrix.org";
        testRoomState.setJoinRule("public");
        testRoomState.setMember(testUserId, "join");
        testRoomState.setMember("@alice:matrix.org", "join");
        var output = mRoomName(roomId);
        expect(output).toEqual(otherUserId);
    });
    
    /**** INVITED TO ROOM ****/
    
    it("should show the other user's display name for private (invite join_rules) rooms if you are invited to it.", function() {
        testUserId = "@me:matrix.org";
        testDisplayName = "Me";
        otherUserId = "@alice:matrix.org";
        testOtherDisplayName = "Alice";
        testRoomState.setJoinRule("private");
        testRoomState.setMember(testUserId, "join");
        testRoomState.setMember(otherUserId, "join");
        testRoomState.setMember(testUserId, "invite");
        var output = mRoomName(roomId);
        expect(output).toEqual(testOtherDisplayName);
    });
    
    it("should show the other user's ID for private (invite join_rules) rooms if you are invited to it and the inviter doesn't have a display name.", function() {
        testUserId = "@me:matrix.org";
        testDisplayName = "Me";
        otherUserId = "@alice:matrix.org";
        testRoomState.setJoinRule("private");
        testRoomState.setMember(testUserId, "join");
        testRoomState.setMember(otherUserId, "join");
        testRoomState.setMember(testUserId, "invite");
        var output = mRoomName(roomId);
        expect(output).toEqual(otherUserId);
    });
});

describe('duration filter', function() {
    var filter, durationFilter;
    
    beforeEach(module('matrixWebClient'));
    beforeEach(inject(function($filter) {
        filter = $filter;
        durationFilter = filter("duration");
    }));
    
    it("should represent 15000 ms as '15s'", function() {
        var output = durationFilter(15000);
        expect(output).toEqual("15s");
    });
    
    it("should represent 60000 ms as '1m'", function() {
        var output = durationFilter(60000);
        expect(output).toEqual("1m");
    });
    
    it("should represent 65000 ms as '1m'", function() {
        var output = durationFilter(65000);
        expect(output).toEqual("1m");
    });
    
    it("should represent 10 ms as '0s'", function() {
        var output = durationFilter(10);
        expect(output).toEqual("0s");
    });
    
    it("should represent 4m as '4m'", function() {
        var output = durationFilter(1000*60*4);
        expect(output).toEqual("4m");
    });
    
    it("should represent 4m30s as '4m'", function() {
        var output = durationFilter(1000*60*4 + 1000*30);
        expect(output).toEqual("4m");
    });
    
    it("should represent 2h as '2h'", function() {
        var output = durationFilter(1000*60*60*2);
        expect(output).toEqual("2h");
    });
    
    it("should represent 2h35m as '2h'", function() {
        var output = durationFilter(1000*60*60*2 + 1000*60*35);
        expect(output).toEqual("2h");
    });
    
    it("should represent -ve numbers as '0s'", function() {
        var output = durationFilter(-2000);
        expect(output).toEqual("0s");
    });
});

describe('orderMembersList filter', function() {
    var filter, orderMembersList;
    
    beforeEach(module('matrixWebClient'));
    beforeEach(inject(function($filter) {
        filter = $filter;
        orderMembersList = filter("orderMembersList");
    }));
    
    var makeMember = function(lastActive, lastUpdated, membership, presence) {
        return {
            event: {
                content: {
                    membership: membership
                }
            },
            user: {
                event: {
                    content: {
                        presence: presence,
                        last_active_ago: lastActive
                    }
                },
                last_updated: lastUpdated
            }
        };
    };
    
    var makeMemberWithId = function(id, lastActive, lastUpdated, membership, presence) {
        return {
            id: id,
            event: {
                content: {
                    membership: membership
                }
            },
            user: {
                event: {
                    content: {
                        presence: presence,
                        last_active_ago: lastActive
                    }
                },
                last_updated: lastUpdated
            }
        };
    };
    
    
    it("should sort a single entry", function() {
        var output = orderMembersList({
            "@a:example.com": makeMember(50, 1415266943964, "join")
        });
        expect(output).toEqual([
            makeMemberWithId("@a:example.com", 50, 1415266943964, "join")
        ]);
    });
    
    it("should sort by taking last_active_ago into account", function() {
        var output = orderMembersList({
            "@a:example.com": makeMember(1000, 1415266943964, "join"),
            "@b:example.com": makeMember(50, 1415266943964, "join"),
            "@c:example.com": makeMember(99999, 1415266943964, "join")
        });
        expect(output).toEqual([
            makeMemberWithId("@b:example.com", 50, 1415266943964, "join"),
            makeMemberWithId("@a:example.com", 1000, 1415266943964, "join"),
            makeMemberWithId("@c:example.com", 99999, 1415266943964, "join")
        ]);
    });
    
    it("should sort by taking last_updated into account", function() {
        var output = orderMembersList({
            "@a:example.com": makeMember(1000, 1415266943964, "join"),
            "@b:example.com": makeMember(1000, 1415266900000, "join"),
            "@c:example.com": makeMember(1000, 1415266943000, "join")
        });
        expect(output).toEqual([
            makeMemberWithId("@a:example.com", 1000, 1415266943964, "join"),
            makeMemberWithId("@c:example.com", 1000, 1415266943000, "join"),
            makeMemberWithId("@b:example.com", 1000, 1415266900000, "join")
        ]);
    });
    
    it("should sort by taking last_updated and last_active_ago into account", 
    function() {
        var output = orderMembersList({
            "@a:example.com": makeMember(1000, 1415266943000, "join"),
            "@b:example.com": makeMember(100000, 1415266943900, "join"),
            "@c:example.com": makeMember(1000, 1415266943964, "join")
        });
        expect(output).toEqual([
            makeMemberWithId("@c:example.com", 1000, 1415266943964, "join"),
            makeMemberWithId("@a:example.com", 1000, 1415266943000, "join"),
            makeMemberWithId("@b:example.com", 100000, 1415266943900, "join"),
        ]);
    });
    
    // SYWEB-26 comment
    it("should sort members who do not have last_active_ago value at the end of the list", 
    function() {
        // single undefined entry
        var output = orderMembersList({
            "@a:example.com": makeMember(1000, 1415266943964, "join"),
            "@c:example.com": makeMember(undefined, 1415266943964, "join"),
            "@b:example.com": makeMember(100000, 1415266943964, "join")
        });
        expect(output).toEqual([
            makeMemberWithId("@a:example.com", 1000, 1415266943964, "join"),
            makeMemberWithId("@b:example.com", 100000, 1415266943964, "join"),
            makeMemberWithId("@c:example.com", undefined, 1415266943964, "join")
        ]);
    });
    
    it("should sort multiple members who do not have last_active_ago according to presence", 
    function() {
        // single undefined entry
        var output = orderMembersList({
            "@a:example.com": makeMember(undefined, 1415266943964, "join", "unavailable"),
            "@b:example.com": makeMember(undefined, 1415266943964, "join", "online"),
            "@c:example.com": makeMember(undefined, 1415266943964, "join", "offline")
        });
        expect(output).toEqual([
            makeMemberWithId("@b:example.com", undefined, 1415266943964, "join", "online"),
            makeMemberWithId("@a:example.com", undefined, 1415266943964, "join", "unavailable"),
            makeMemberWithId("@c:example.com", undefined, 1415266943964, "join", "offline")
        ]);
    });
    
    it("should remove members who have left the room.", 
    function() {
        // single undefined entry
        var output = orderMembersList({
            "@a:example.com": makeMember(100000, 1415266943964, "invite"),
            "@b:example.com": makeMember(1000, 1415266943964, "join"),
            "@c:example.com": makeMember(10, 1415266943964, "leave")
        });
        expect(output).toEqual([
            makeMemberWithId("@b:example.com", 1000, 1415266943964, "join"),
            makeMemberWithId("@a:example.com", 100000, 1415266943964, "invite"),
        ]);
    });
    
    it("should remove members who have been kicked or banned from the room.", 
    function() {
        // single undefined entry
        var output = orderMembersList({
            "@a:example.com": makeMember(100000, 1415266943964, "join"),
            "@b:example.com": makeMember(1000, 1415266943964, "ban"),
            "@c:example.com": makeMember(10, 1415266943964, "kick")
        });
        expect(output).toEqual([
            makeMemberWithId("@a:example.com", 100000, 1415266943964, "join"),
        ]);
    });
});
describe('mUserDisplayName filter', function() {
    var filter, mUserDisplayName;
    
    var roomId = "!weufhewifu:matrix.org";
    
    // test state values (f.e. test)
    var testUser_displayname, testUser_user_id;
    var testSelf_displayname, testSelf_user_id;
    var testRoomState;
    
    // mocked services which return the test values above.
    var matrixService = {
        config: function() {
            return {
                user_id: testSelf_user_id
            };
        }
    };
    
    var modelService = {
        getRoom: function(room_id) {
            return {
                current_room_state: testRoomState
            };
        },
        
        getUser: function(user_id) {
            return {
                event: {
                    content: {
                        displayname: testUser_displayname
                    },
                    event_id: "wfiuhwf@matrix.org",
                    user_id: testUser_user_id
                }
            };
        },
        
        getMember: function(room_id, user_id) {
            return testRoomState.members[user_id];
        }
    };
    
    beforeEach(function() {
        // inject mocked dependencies
        module(function ($provide) {
            $provide.value('matrixService', matrixService);
            $provide.value('modelService', modelService);
        });
        
        module('matrixFilter');
    });
    
    
    beforeEach(inject(function($filter) {
        filter = $filter;
        mUserDisplayName = filter("mUserDisplayName");
        
        // purge the previous test values
        testSelf_displayname = "Me"; 
        testSelf_user_id = "@me:matrix.org";
        testUser_displayname = undefined; 
        testUser_user_id = undefined;
        
        // mock up a stub room state
        testRoomState = {
            s:{}, // internal; stores the state events
            state: function(type, key) {
                // accessor used by filter
                return key ? this.s[type+key] : this.s[type];
            },
            members: {}, // struct used by filter
            
            // test helper methods
            setMember: function(user_id, displayname, membership, inviter_user_id) {
                if (!inviter_user_id) {
                    inviter_user_id = user_id;
                }
                if (!membership) {
                    membership = "join";
                }
                this.s["m.room.member" + user_id] = {
                    event: {
                        content: {
                            displayname: displayname,
                            membership: membership
                        },
                        state_key: user_id,
                        user_id: inviter_user_id 
                    }
                };
                this.members[user_id] = this.s["m.room.member" + user_id];
            }
        };
    }));
    
    it("should show the display name of a user in a room if they have set one.", function() {
        testUser_displayname = "Tom Scott";
        testUser_user_id = "@tymnhk:matrix.org";
        testRoomState.setMember(testUser_user_id, testUser_displayname);
        testRoomState.setMember(testSelf_user_id, testSelf_displayname);
        var output = mUserDisplayName(testUser_user_id, roomId);
        expect(output).toEqual(testUser_displayname);
    });
    
    it("should show the user_id of a user in a room if they have no display name.", function() {
        testUser_user_id = "@mike:matrix.org";
        testRoomState.setMember(testUser_user_id, testUser_displayname);
        testRoomState.setMember(testSelf_user_id, testSelf_displayname);
        var output = mUserDisplayName(testUser_user_id, roomId);
        expect(output).toEqual(testUser_user_id);
    });
    
    it("should still show the displayname of a user in a room if they are not a member of the room but there exists a User entry for them.", function() {
        testUser_user_id = "@alice:matrix.org";
        testUser_displayname = "Alice M";
        testRoomState.setMember(testSelf_user_id, testSelf_displayname);
        var output = mUserDisplayName(testUser_user_id, roomId);
        expect(output).toEqual(testUser_displayname);
    });
    
    it("should disambiguate users with the same displayname with their user id.", function() {
        testUser_displayname = "Reimu";
        testSelf_displayname = "Reimu";
        testUser_user_id = "@reimu:matrix.org";
        testSelf_user_id = "@xreimux:matrix.org";
        testRoomState.setMember(testUser_user_id, testUser_displayname);
        testRoomState.setMember(testSelf_user_id, testSelf_displayname);
        var output = mUserDisplayName(testUser_user_id, roomId);
        expect(output).toEqual(testUser_displayname + " (" + testUser_user_id + ")");
    });
    
    it("should wrap user IDs after the : if the wrap flag is set.", function() {
        testUser_user_id = "@mike:matrix.org";
        testRoomState.setMember(testUser_user_id, testUser_displayname);
        testRoomState.setMember(testSelf_user_id, testSelf_displayname);
        var output = mUserDisplayName(testUser_user_id, roomId, true);
        expect(output).toEqual("@mike :matrix.org");
    });
});
describe('orderRecents filter', function() {
    var filter, orderRecents;
    
    var roomId = "!weufhewifu:matrix.org";
    
    // test state values (f.e. test)
    var testUserId;
    var testMembers = {
        // room_id+user_id: member
    };
    var testUserCount = {
        // room_id: userCount
    };
    
    // mocked services which return the test values above.
    var matrixService = {
        config: function() {
            return {
                user_id: testUserId
            };
        }
    };
    
    var modelService = {
        getUserCountInRoom: function(roomId) {
            return testUserCount[roomId];
        },
        
        getMember: function(room_id, user_id) {
            return testMembers[room_id+user_id];
        }
    };
    
    beforeEach(function() {
        // inject mocked dependencies
        module(function ($provide) {
            $provide.value('matrixService', matrixService);
            $provide.value('modelService', modelService);
        });
        
        module('RecentsFilter');
    });
    
    
    beforeEach(inject(function($filter) {
        filter = $filter;
        orderRecents = filter("orderRecents");
        
        // purge the previous test values
        testUserCount = {};
        testMembers = {};
        testUserId = "@me:matrix.org";
    })); 

    // helper function
    var makeRoom = function(roomId, memberlist) {
        var room = {
            current_room_state: {
                s: {
            
                },
                state: function(type,key) {
                    return this.s[key === undefined ? type : type+key];
                }
            },
            now: this.current_room_state,
            lastAnnotatedEvent: {},
            room_id: roomId,
            events: []
        };

        for (userId in memberlist) {
            var event = {
                content: memberlist[userId],
                state_key: userId
            };
            room.current_room_state.s["m.room.member"+userId] = event;
            testMembers[roomId+userId] = { // side-effect, dump in testMembers
                event: event
            };
        }
        return room;
    };
    
    it("should sort rooms you've been invited to (no timestamp) at the top.", function() {
        var roomA = "!aaa:localhost";
        var roomB = "!bbb:localhost";
        var rooms = {};
        rooms[roomA] = makeRoom(roomA, {
            "@me:matrix.org": {
                membership: "join"
            }
        });
        rooms[roomA].lastAnnotatedEvent = {
            event: {
                origin_server_ts: 200
            }
        };

        rooms[roomB] = makeRoom(roomB, {
            "@me:matrix.org": {
                membership: "invite"
            }
        });
        rooms[roomB].lastAnnotatedEvent = undefined;

        var output = orderRecents(rooms);
        expect(output.length).toBe(2);
        expect(output[0].room_id).toEqual(roomB);
        expect(output[1].room_id).toEqual(roomA);
    });

    it("should sort rooms based on the last message timestamp.", function() {
        var roomA = "!aaa:localhost";
        var roomB = "!bbb:localhost";
        var rooms = {};
        rooms[roomA] = makeRoom(roomA, {
            "@me:matrix.org": {
                membership: "join"
            }
        });
        rooms[roomA].lastAnnotatedEvent = {
            event: {
                origin_server_ts: 200
            }
        };

        rooms[roomB] = makeRoom(roomB, {
            "@me:matrix.org": {
                membership: "join"
            }
        });
        rooms[roomB].lastAnnotatedEvent = {
            event: {
                origin_server_ts: 100
            }
        };

        var output = orderRecents(rooms);
        expect(output.length).toBe(2);
        expect(output[0].room_id).toEqual(roomA);
        expect(output[1].room_id).toEqual(roomB);
    });
});

