## Reddit image downloader

Using given script user can download png images from reddit posts. I have created this script to download images from [unixp*rn](https://old.reddit.com/r/unixporn/new) hub. Script scans latest posts and downloads only images that are:
 - png or gif;
 - are not part of album on another service (yes, no imgur, because it decreases quality down to jpg);
 - have certain tags;
 - not older than ones from previous run or 30 days.

 ![example in action](https://raw.githubusercontent.com/kaytrance/reddit-image-downloader/master/preview.gif)


To fetch all dependencies run `npm install`.

To run script run this `npm start` or `node fetch.js`. It will fetch images into `images` folder.

Tags are defined in `TAGS` constant. 

To avoid redownloading the same files `timestamp.txt` file is used where timestamp from previous run is stored. So next time the script is launched it will download only new images. When this file is not present (first run) script will download all images from last 30 days. This can be changed by modifying `MAX_DAYS_FETCH` constant.

After script finishes its work it will show skipped tags. I have set mine to get images with that minimal tiled window managers, but they can be changed to get KDE as well.

In theory this script can be used to get images from another reddits with minor changes although I have no use for it to test that.
