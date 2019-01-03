var axios   = require("axios");
var chalk   = require("chalk");
var cheerio = require("cheerio");
var fs      = require("fs");
var moment  = require("moment");



// keep a counter of how many pages we dig already
let CURRENT_PAGE = 1;


// how many pages to go in the past
const MAX_PAGES = 50;


// number of days to get images from if no LAST_TIMESTAMP will be read from file
const MAX_DAYS_FETCH = 30;


// these tags we are interested in
const TAGS = [
   "2bwm",
   "9wm",
   "awesome",
   "awesomewm",
   "bspwm",
   "chunkwm",
   "cwm",
   "dwm",
   "evilwm",
   "exwm",
   "gaps",
   "frankenwm",
   "fvwm",
   "hlwm",
   "herbstluftwm",
   "i3", 
   "i3gaps", 
   "i3wm",
   "pekwm",
   "spectrwm",
   "eveningwm",
   "termux",
   "twm",
   "uwurawrxdwm",
   "icewm",
   "windowmaker"
];


/**  
 * here we will store tags that were skipped. 
 * we will analyze them later so to understand if we missed something good or not
 */
var SKIPPED_TAGS = [];


/**
 * It will hold timestamp of an image that was already downloaded in previous runs.
 * It will be populated from `timestamp.txt` file. If no file exists then script
 * will run and fetch `MAX_PAGES` pages.
 */
var LAST_TIMESTAMP = null;


// file where timestamp will be saved
const TIMESTAMP_FILENAME = "timestamp.txt";


/**
 * it fetched URL provided and returns DOM tree.
 * @param {*} url - url of page to fetch
 */
function GetPage(url) {
   return new Promise((resolve, reject) => {
      axios.get(url).then(response => {
         resolve(cheerio.load(response.data));
      });
   });
}



/**
 * it downloads file at provided url and saves it under provided name.
 * @param {*} url - url to download
 * @param {*} save_as - name to safe file with
 */
function DownloadAsImage(url, save_as) {
   return new Promise((resolve, reject) => {
      let opts = {
         responseType: "arraybuffer"
      };
      axios.get(url, opts).then(response => {
         fs.writeFileSync("images/" + save_as, response.data);
         resolve();
      });
   });
}



/**
 * it extracts tags from given string.
 * @param {String} tag_string - string (title) to extract tags from
 * @returns {Array} - array of tags
 */
function ExtractTags(tag_string) {
   // get everything that looks like tags
   let regex = tag_string.match(/\[(.*?)\]/g);

   if(!regex)
      return null;
   
   let resulting_tag_set = [];
   regex.forEach(tag => {
      // get rid of brackets and make it lowercase
      let _tag = tag.toLowerCase().replace("[", "").replace("]", "");

      // replace symbols that may be look like ones that split tags with some marker
      const replacer = " ";
      _tag = _tag.split("+").join(replacer);
      _tag = _tag.split("/").join(replacer);
      _tag = _tag.split(" ").join(replacer);

      // now split by that replacer and push to resulting_tag_set
      _tag.split(replacer).forEach(new_tag => {
         if(new_tag !== "")
            resulting_tag_set.push(new_tag);
      });
   });

   return resulting_tag_set;
}



/**
 * it gets all links from page and tries to download only needed images.
 * @param {*} url - page URL where processing will occur
 * @returns {String or null} - next page URL or nothing;
 */
function ProcessOnePage(url) {
   return new Promise(async(resolve, reject) => {
      // get current page dom
      let $ = await GetPage(url);
      
      let next_page_url = $(".nav-buttons .next-button a").attr("href");
      
      // get array of image sections
      let lis = $("#siteTable .thing");

      // iterate over gathered blocks and 
      for(let i = 0; i < lis.length; i++) {
         let block_id = lis[i].attribs["data-fullname"];
         let block_url = lis[i].attribs["data-url"];
         let block_timestamp = lis[i].attribs["data-timestamp"]; 
         let block_title = $(lis[i]).find("a.title").text();

         let tag = ExtractTags(block_title);

         // check timestamp, resolve right away if this image was already processed
         let current_timestamp = parseInt(block_timestamp, 10)
         if(LAST_TIMESTAMP > current_timestamp) {
            console.log(chalk.bold("ABORTING: timestamp reached"));
            CURRENT_PAGE = Number.MAX_SAFE_INTEGER;
            i = Number.MAX_SAFE_INTEGER;
            return resolve();
         }
         
         if(!tag) {
            console.log(`..${chalk.bold(`#${i}`)} SKIP: no tags in ${chalk.bold(block_title)} at ${chalk.bold(block_url)}`);
         }

         // check tag
         if(tag) {
            let tag_check = false;
            for(let i = 0; i < tag.length; i++) {
               if(TAGS.indexOf(tag[i]) !== -1) {
                  tag_check = true;
                  i = 1000;
               }
               else {
                  if(SKIPPED_TAGS.indexOf(tag[i]) === -1)
                     SKIPPED_TAGS.push(tag[i]);
               }
            }

            if(tag_check) {
               // if it"s a direct PNG image then download it straight away
               const check_if_gif = block_url.indexOf(".gif") !== -1;
               const check_if_png = block_url.indexOf(".png") !== -1;
               if(check_if_gif) {
                  console.log(`..${chalk.bold(`#${i}`)} ${chalk.green("GET")}: downloading gif ${chalk.bold(block_id)} [${chalk.bold(tag)}] from ${chalk.bold(block_url)}`);
                  await DownloadAsImage(block_url, block_id + ".gif");
               }
               else if(check_if_png) {
                  console.log(`..${chalk.bold(`#${i}`)} ${chalk.green("GET")}: downloading png ${chalk.bold(block_id)} [${chalk.bold(tag)}] from ${chalk.bold(block_url)}`);
                  await DownloadAsImage(block_url, block_id + ".png");
               }
               else
                  console.log(`..${chalk.bold(`#${i}`)} SKIP: not png ${chalk.bold(block_id)} [${chalk.bold(tag)}] from ${chalk.bold(block_url)}`);
            }
            else
               console.log(`..${chalk.bold(`#${i}`)} SKIP: unwanted tag(s) [${chalk.bold(tag.join(", "))}] at ${chalk.bold(block_url)}`);
         }

      }
      resolve(next_page_url);
   });
}



/**
 * it starts processing page by URL provided.
 * @param {String} url - page to start from
 */
async function Start(url) {

   // save current moment so we could save it to timestamp.txt if everything will go well
   let current_moment = moment().valueOf();

   // get last timestamp from file (if any)
   if(fs.existsSync(TIMESTAMP_FILENAME)) {
      LAST_TIMESTAMP = parseInt(fs.readFileSync(TIMESTAMP_FILENAME), 10);
      let last_run_ago = moment(LAST_TIMESTAMP).fromNow();
      console.log(`timestamp read from ${chalk.bold(TIMESTAMP_FILENAME)}. Last run was ${chalk.bold(last_run_ago)}`);
   }
   else {
      console.warn(`no timestamp was found, script will fetch last ${chalk.bold(MAX_DAYS_FETCH)} days then or maximum ${chalk.bold(MAX_PAGES)} pages`);
      LAST_TIMESTAMP = moment().subtract(MAX_DAYS_FETCH, "days").valueOf();
   }


   while(CURRENT_PAGE < MAX_PAGES) {
      console.log(`PROCESSING PAGE ${chalk.bold(CURRENT_PAGE)}`);
      url = await ProcessOnePage(url);

      CURRENT_PAGE++;
   }

   // write last timestamp to file
   console.log("--------------------------------------------------------------------------------");
   console.log(`SAVING LAST TIMESTAMP TO ${chalk.bold(TIMESTAMP_FILENAME)}..`);
   fs.writeFileSync(TIMESTAMP_FILENAME, current_moment);
   
   console.log("TAGS SKIPPED:", chalk.bold(SKIPPED_TAGS.sort().join(", ")));
   console.log("--------------------------------------------------------------------------------");
}




Start("https://old.reddit.com/r/unixporn/new/");
