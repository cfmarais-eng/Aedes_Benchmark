# Aedes_Benchmark
Some basic classes for performing tests on an aedes broker. Some initial work is done to support bridging, but is regarded as disfunctional. 


# Spatial Subscription Transform for SPAT
Code for required initial variables and functions required for the topic-to-spatial conversion.
Reuires the fnv-plus package. Just copy this code into the SPAT client, or convert into its own class if you really want to.

NOTE: if you are subscribing to "unique ID" topics, you must obviously use that unique ID topic for this conversion.


# BROKER TO BE USED FOR SPAT: https://github.com/hebrecht/aedes/

# NOTE: All files besides the spatial message transform are leftovers from my basic mqtt benchmark. 

# Client class
This client uses the standard mqtt-client package. The class supports all of the basic MQTT-type requests (subscribe, unsubscribe, publish) and has a publication listener. I do not quite understand why SPAT should use mqtt-react hooks but this example may be useful

# broker and bridged broker
Do not use. Do not touch. 
SPAT must use https://github.com/hebrecht/aedes/. 

These brokers are in essance just janky wrappers. Some work has been done to extend the brokers to bridge but it is regarded as disfunctional and useless at this stage.
