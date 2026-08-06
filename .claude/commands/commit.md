Let's commit the changes.

**Split large changes**: If changes touch multiple concerns, split them into separate commits
**Write a commit message that matches the content of your change**: Clearly describe what was changed in this commit. A good commit message should:
- Specify the component or feature affected (e.g., "authentication module").
- Describe the action taken (e.g., "fixed a bug," "added a new feature").
- Avoid vague messages like "fix bug" or "update code."

Examples of good commit messages:
- 🐛 Fixed a bug in the authentication module causing login failures
- ✨ Added a new feature to filter tables by column
- 📝 Updated README.md with new installation instructions

Examples of bad commit messages:
- "fix bug"
- "update code"
- "changes made"
- Use gitmoji (optional, recommended): Write commit messages using the emoji (e.g., ✨) itself, not the textual representation (e.g., `:sparkles:`)

## Examples

- ✨ Added a new feature to filter tables
- 🐛 Fixed a typo in the welcome message
- 📝 Updated README.md with new installation instructions

## Gitmoji Reference

### Frequently Used
- 🚸 `:children_crossing:` - Improve user experience / usability
- ✨ `:sparkles:` - Introduce new features
- 🐛 `:bug:` - Fix a bug
- ♻️ `:recycle:` - Refactor code
- ⚡ `:zap:` - Improve performance
- 💄 `:lipstick:` - Add or update the UI and style files
- 🎨 `:art:` - Improve structure / format of the code
- 📝 `:memo:` - Add or update documentation
- 🔧 `:wrench:` - Add or update configuration files

### Testing & Quality
- ✅ `:white_check_mark:` - Add, update, or pass tests
- 🚨 `:rotating_light:` - Fix compiler / linter warnings
- 🧪 `:test_tube:` - Add a failing test
- 🥅 `:goal_net:` - Catch errors

### Critical Changes
- 🚑 `:ambulance:` - Critical hotfix
- 💥 `:boom:` - Introduce breaking changes
- 🔒 `:lock:` - Fix security or privacy issues

### Dependencies & CI/CD
- ➕ `:heavy_plus_sign:` - Add a dependency
- ➖ `:heavy_minus_sign:` - Remove a dependency
- ⬆️ `:arrow_up:` - Upgrade dependencies
- ⬇️ `:arrow_down:` - Downgrade dependencies
- 💚 `:green_heart:` - Fix CI Build
- 👷 `:construction_worker:` - Add or update CI build system

### Code Management
- 🔥 `:fire:` - Remove code or files
- ⚰️ `:coffin:` - Remove dead code
- 🚚 `:truck:` - Move or rename resources (e.g.: files, paths, routes)
- ⏪ `:rewind:` - Revert changes
- 🔀 `:twisted_rightwards_arrows:` - Merge branches

### Work in Progress
- 🚧 `:construction:` - Work in progress
- 🩹 `:adhesive_bandage:` - Simple fix for a non-critical issue

### Types & Database
- 🏷️ `:label:` - Add or update types
- 🗃️ `:card_file_box:` - Perform database related changes

### Accessibility & i18n
- ♿ `:wheelchair:` - Improve accessibility
- 🌐 `:globe_with_meridians:` - Internationalization and localization

### Other Useful
- 🚀 `:rocket:` - Deploy stuff
- 🔖 `:bookmark:` - Release / Version tags
- 📱 `:iphone:` - Work on responsive design
- 💫 `:dizzy:` - Add or update animations and transitions
- ✏️ `:pencil2:` - Fix typos
- 🙈 `:see_no_evil:` - Add or update a .gitignore file
- 🔊 `:loud_sound:` - Add or update logs
- 🔇 `:mute:` - Remove logs

For the complete list, run `gitmoji list` or visit [gitmoji.dev](https://gitmoji.dev/).
