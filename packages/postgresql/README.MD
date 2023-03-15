# Postgresql Algorithm for lock guarantees 

## Start
We create a table for locks if it doesn't exist, table name is customizable 
```sql
CREATE TABLE IF NOT EXISTS table } (
    key varchar(50),
    value varchar(100) NOT NULL,
    ttl integer NOT NULL,
    obtained_at timestamp DEFAULT current_timestamp,
    CONSTRAINT pk_index PRIMARY KEY (key)
);
```
## Acquiring Lock
We start a transaction with isolation level repeatable read
and it only has one SQL statement that inserts the row representing the lock

```SQL
INSERT INTO table (key, value, ttl, obtained_at)
VALUES ('key', 'lock-value', 10, current_timestamp)
ON CONFLICT ON CONSTRAINT pk_index
DO
    UPDATE SET value = 'lock-value', ttl = 10
    WHERE locks.obtained_at + interval '1' second * locks.ttl  < current_timestamp
returning *
```

Using the key that represents the critical section as primary key,
we try to insert a record with it and the value represents our lock, if there is a conflict on the primary key constraint (someone else was able to acquire the lock) we can still update that row **only if the previous lock expired** (it's ttl + obtained at < current time stamp>).

If the upsert operation was successful we return a truthy value

## Releasing Lock
Same as acquiring a lock we use a transaction with isolation level repeatable read. Simply delete the row with key equal to the critical section value, and the value equal to the lock value

```sql
DELETE FROM table
where key = 'key' AND value = 'lock-value';
```