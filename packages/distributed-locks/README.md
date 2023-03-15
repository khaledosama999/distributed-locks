# Distributed Locks
A package for managing locks for critical section in a micro-service/horizontal deployment 

## Motivation

Most packages for managing access to critical sections assume **a single machine deployment** scenario (locks are local to the process running not across multiple process/machines), given todays standards that's very unlikely, for availability we might have replicas of the same app up and running but we still need **a centralized** way of managing lock across those replicas

## Available Storage Layers
| Storage | Link |
| -------- | ------- |
| Redis | [distributed-locks-redis](https://www.npmjs.com/package/distributed-locks-redis)|
| Postgresql | [distributed-locks-postgresql](https://www.npmjs.com/package/distributed-locks-postgresql)|
| Mongodb | [distributed-locks-mongodb](https://www.npmjs.com/package/distributed-locks-mongodb)|


## Usage

```js
import LocksFactory, {FailedToObtainKey} from 'distributed-locks'
import {RedisStorage} from 'distributed-locks-redis'

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
|  arg0.url | string | true | - | Redis connection url, should start with `redis://` |

### Postgresql storage
```js
  const storage = new PostgresqlStorage({
      keyPrefix,
      tableName: 'locks',
      database: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      username: 'user',
      password: 'password',
    });
```

#### Constructor

| arguments | type |required| default | description |
| ------- | ---------- | ---------- | --------- | --------- |
| arg0.keyPrefix | string | false | 'distributed-locks' | Prefix for all the keys used to make locks in redis, used to prevent conflicts with other keys |
|  arg0.port | number | true | - | Port of the Postgresql server|
|  arg0.host | string | true | - | Host of the Postgresql server|
|  arg0.database | string | true | - | Name of the database|
|  arg0.username | string | true | - | Username of the Postgresql server|
|  arg0.password | string | true | - | Password of the username provided|
|  arg0.tableName | string | false | locks | The table name that will be used to store locks states|

### MongoDB storage
```js
const storage = new MongoStorage({ url: 'mongodb://.....', database: 'db', collectionName: 'locks'});
```

#### Constructor
| arguments | type |required| default | description |
| ------- | ---------- | ---------- | --------- | --------- |
|  arg0.url | string | true | - | Redis connection url, should start with `redis://`|
|  arg0.database | string | true | - | Name of the database|
|  arg0.collectionName | string | false | locks | The collection name that will be used to store locks states|

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

## Tests
To run tests locally you need a running docker host, as some tests spawn up docker containers

## Guarantees

- At any given time, for the same value for the key, only one lock can be locked 
- Locking doesn't cause starvation as there is a ttl on each lock obtained
- If the locks ttl expires and `unlock` was called on the lock, it won't unlock that section if it was already obtained by another lock 

### Redis 
Guarantees are done by applying the red-lock algorithm and lua scripts to provide atomicity of any operation

### Postgres
Guarantees are done by using `REPEATABLE READ ISOLATION` level for transactions to set/delete keys, the statement is a single insert statement with `ON CONFLICT` with the key value condition, updates the current row **only if it already expired** (checkout the [postgres storage file](./src/storage/postgres.ts)).

### MongoDB
Using mongo default atomicity guarantees on single document, and unique index on the `_id` field