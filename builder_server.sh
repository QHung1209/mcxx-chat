if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo ".env file not found!"
  exit 1
fi

unzip dist.zip
rm -rf main_dist
mv dist main_dist
rm -rf dist.zip

# Check NODE_ENV and run different commands
if [ "$NODE_ENV" = "development" ]; then
  echo "NODE_ENV=development"

  pm2 delete "mcxx_chat_primary"

  pm2 start main_dist/main.js --name "mcxx_chat_primary"
else
  echo "NODE_ENV=$NODE_ENV"

  pm2 delete "mcxx_chat_primary"
  pm2 delete "mcxx_chat_replica"

  pm2 start pm2.json
fi

pm2 log mcxx_chat_primary
