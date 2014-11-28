#!/bin/bash

# Script that posts org.matrix.midi to a room.

# URL used to post the events
# Change it to suitable room id / access token
MIDIURL='http://localhost:8080/_matrix/client/api/v1/rooms/!CLNFJsVWPPGZDwjIsG%3Alocalhost%3A8480/send/org.matrix.midi?access_token=QE1hbnU6bG9jYWxob3N0Ojg0ODA..ijnMgaZRTQWTcWTDeM'

echo $MIDIURL

# Give the tempo to webclient with the first 4 stroke
curl $MIDIURL -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"state":"on","note":60,"midi_ts":0}'
curl $MIDIURL -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"state":"on","note":60,"midi_ts":1000}'
curl $MIDIURL -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"state":"on","note":60,"midi_ts":2000}'
curl $MIDIURL -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"state":"on","note":60,"midi_ts":3000}'

# bug ??? The client consider it as a end of a rest
curl $MIDIURL -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"state":"on","note":60,"midi_ts":4000}'

# Now play
# 1st measure
curl $MIDIURL -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"state":"on","note":60,"midi_ts":4000}'
curl $MIDIURL -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"state":"off","note":60,"midi_ts":5000}'
curl $MIDIURL -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"state":"on","note":62,"midi_ts":5000}'
curl $MIDIURL -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"state":"off","note":62,"midi_ts":6000}'
curl $MIDIURL -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"state":"on","note":64,"midi_ts":6000}'
curl $MIDIURL -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"state":"off","note":64,"midi_ts":7000}'
curl $MIDIURL -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"state":"on","note":65,"midi_ts":7000}'
curl $MIDIURL -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"state":"off","note":65,"midi_ts":8000}'

# 2nd measure
curl $MIDIURL -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"state":"on","note":67,"midi_ts":8000}'
curl $MIDIURL -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"state":"off","note":67,"midi_ts":10000}'
curl $MIDIURL -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"state":"on","note":69,"midi_ts":10000}'
curl $MIDIURL -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"state":"off","note":69,"midi_ts":12000}'

# Start 3rd to make the client render the 2nd
curl $MIDIURL -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"state":"on","note":68,"midi_ts":12000}'
curl $MIDIURL -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"state":"off","note":68,"midi_ts":12800}'
