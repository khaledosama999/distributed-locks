local check_local_key_exists = redis.call('GET', KEYS[1])
          if (check_local_key_exists)
          then
            redis.call('DEL', KEYS[1])
            redis.call('DEL', ARGV[1])
          end
            return 'OK'