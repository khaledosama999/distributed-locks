# Redis Algorithm for lock guarantees 

## Acquiring Lock
At the start of the connection a lua script is loaded into the redis instance 

```lua
local key = redis.call('GET', KEYS[1])
if (not key)
    then
        redis.call('SET',KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2])
        return 'OK'
    else
        return nil
        end
```

it takes the key (represents the critical section) and two arguments the value (represents the lock that is trying to get hold of a critical section) and the expiration time in seconds (ttl)

Since redis is single threaded and lua scripts are atomic we don't expect race conditions in this script.
Steps:
- Get the current key value
  - If nil it means we can acquire the lock, set it's value to the current lock value and return (truthy value)
  - If not nil means someone else already has a lock on this critical section so return nil (falsy value)

## Releasing Lock
Same as acquiring a lock a script is loaded for releasing a lock 

```lua
local key = redis.call('GET', KEYS[1])
if (key == ARGV[1])
    then
        redis.call('DEL', KEYS[1])
    end
        return 'OK'
```

Again single threaded no race conditions and the script is atomic.
Steps:
 - Retrieve the key from redis that represents the critical section we obtained a lock on 
    - If the value of that key matches our lock (means we still hold a lock on that critical section) then we delete the key
    - else it's either null which means our ttl is over and it's too late to release the key as it was already released, or it might have another value as again our ttl is over and another lock was able to obtain it
  - In either case return truthy value