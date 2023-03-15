# MongoDB Algorithm for lock guarantees 

We highly depend on the fact the mongo by default uses the _id as the primary unique key for the collection, and the fact that mongo-db guarantees atomicity on a document level

## Perquisites
Make sure your mongo connection has majority for write concern and read from primary for read preference to avoid any inconsistences

## Acquiring Lock
We first try to get the document in mongo that has the same value for the key (checking if someone else obtained a lock on the same critical section). Plus we project the `current date in mongo` 

```js
db.collection('collection')
    .findOne({ _id: 'key' }, {
        projection: {
          _id: 1,
          value: 1,
          ttl: 1,
          obtained_at: 1,
          current_date: '$$NOW',
        },
    });
```

If returned value is null (no one has a lock on the critical section), we try to **upsert** a document in mongo, we use upsert since in between this step and the previous one someone else might've obtained a lock on the same critical section and it could've even expired. the fields are:
- _id: Represents the critical section
- value: Represents the lock that locked the critical section
- ttl: Time to live in seconds
- obtained_at: The time this lock was successfully acquired

```js
this.db.collection('collection').updateOne({
          _id: 'key',
          value: 'lock-value',
        }, {
          $set: {
            _id: 'key',
            value: 'lock-value',
            ttl: 10,
          },
          $currentDate: {
            obtained_at: { $type: 'date' },
          },
        }, { upsert: true })
```
If this was successful then we obtained the lock on the critical section

If the returned value from step one was not null (someone else obtained a lock for the same critical section), then we can only insert a new document if that returned lock has expired.

We do a simple check from the data returned from step one

```js
if(data.current_date > data.obtained_at + data.ttl) {
    // Lock expired try to obtain a lock for this critical section
} 
else {
    // Lock still active can't lock the same critical section
}
```

If the `if` condition was true we do the following upsert statement

```js
await this.db?.collection<Omit<MongoDocument, 'created_at'>>(this.collectionName).updateOne({
          _id: 'key',
          value: data.value,
          obtained_at: data.obtained_at,
        }, {
          $set: {
            _id: 'key',
            value: 'lock-value',
            ttl: 10,
          },
          $currentDate: {
            obtained_at: { $type: 'date' },
          },
        }, { upsert: true });
```

Notice that we don't only use the `_id` field to upsert the document we also use the the **current lock's `value`** and it's `obtained_at` as again some one else might have obtained the lock on the same critical section (same `_id` value but different `value` and `obtained_at`). If operation was successful then we obtained the lock

## Releasing Lock
A simple delete query using the `_id` and the lock `value`

```js
this.db.collection('collection')
      .deleteOne({
        _id: 'key',
        value: 'lock-value',
      });
```