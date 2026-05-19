# dry run
/opt/homebrew/bin/rsync -aAXhv   --info=progress2   --dry-run   --itemize-changes   --exclude="._*"   --exclude=".DS_Store"   "/Volumes/ShMedia/Tedography/Media/"   "/Volumes/SHAFFEROTO/ShafferographyBackups/TedographyMedia/"

# not dry run
/opt/homebrew/bin/rsync -aAXhv   --info=progress2  --itemize-changes   --exclude="._*"   --exclude=".DS_Store"   "/Volumes/ShMedia/Tedography/Media/"   "/Volumes/SHAFFEROTO/ShafferographyBackups/TedographyMedia/"
