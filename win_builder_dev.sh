echo "start"
rm dist
npm run build
7z a -tzip dist.zip dist
scp dist.zip lqhdev:/home/domains/be-mcxx-chat
rm dist.zip
clear
echo "=============***============="
echo "Build Development Successfully"
