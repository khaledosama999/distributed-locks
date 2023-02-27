# Distributed Locks
A package for managing locks for critical section in a micro-service/horizontal deployment 

## Motivation

Most packages for managing access to critical sections assume **a single machine deployment** scenario (locks are local to the process running not across multiple process/machines), given todays standards that's very unlikely, for availability we might have replicas of the same app up and running but we still need **a centralized** way of managing lock across those replicas

## Usage

```js
import LocksFactory, {RedisStorage, FailedToObtainKey} from 'distributed-locks'

const storage = new RedisStorage({ keyPrefix:'my-locks', url: redisUrl });
const locksFactory = new LockFactory(storage);

// Value of the key should represent the critical section
const lock = locksFactory.createLock('my-key');

try {
    await lock.lock({ttl: 10, interval: 5, retires: 3});
    // execute some code
    // ...
    // ...
}
catch(err){
    if(err instanceOF FailedToObtainKey) {
        // Couldn't get lock
    }
}
finally {
    await lock.unlock()
}
```

## Storage 

The different types of storage supported for maintaining locks states

### Redis storage
```js
const storage = new RedisStorage({ keyPrefix:'my-locks', url: redisUrl });
```

#### Constructor

| arguments | type |required| default | description |
| ------- | ---------- | ---------- | --------- | --------- |
| arg0.keyPrefix | string | false | 'distributed-locks' | Prefix for all the keys used to make locks in redis, used to prevent conflicts with other keys |
|  arg0.url | string | true | - | Redis connection url, should start with `redis://`


## Locks Factory

### Constructor

| arguments | type | required| default | description |
| -------| ---------- | ---------- | ---------| --------- |
| storage | IStorage | true | - | The storage instance that will be used by locks to try and lock critical section |


### Create lock

```js
const lock = locksFactory.createLock('my-key');
```

| arguments | type | required| default | description |
| -------| ---------- | ---------- | ---------| --------- |
| key | string | true | - | The key that will be used to lock a certain critical section |

## Lock

### Lock
```js
await lock.lock({ttl: 10, interval: 5, retires: 3});
```

| arguments | type | required| default | description |
| -------| ---------- | ---------- | ---------| --------- |
| arg0.ttl | number | false | 10 | The time to live for locking the critical section to prevent starvation, should be more than the expected time of work that needs to be done while obtaining a lock |
| arg0.retries | number | false | 3 | The number of times to try to obtain the lock, if the last try fails the function will throw an error |
| arg0.interval | number | false | 1 | The interval of time waiting in seconds between each retry to obtain the lock |


### unlock
```js
await lock.unlock();
```

| arguments | type | required| default | description |
| -------| ---------- | ---------- | ---------| --------- |


## Guarantees

- At any given time, for the same value for the key, only one lock can be locked 
- Locking doesn't cause starvation as there is a ttl on each lock obtained
- If the locks ttl expires and `unlock` was called on the lock, it won't unlock that section if it was already obtained by another lock 

### Redis 

Guarantees are done by applying the red-lock algorithm and lua scripts to provide atomicity of any operation