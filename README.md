# bridge-node

## Setting up

Install
```
npm i
```

Launch test networks and validator
```
pm2 start eco.json.example
```
Run default tests

```
npm test
```

## Run alternative tests
```
npm run test -- --config enq-test-test.json
```
