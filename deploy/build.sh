#!/usr/bin/env bash
# Build & deploy OpenDeck trên server.
# Dùng: bash deploy/build.sh   (hoặc: BRANCH=dev bash deploy/build.sh)

# Variable
BRANCH=${BRANCH:-main}
WORKING_SOURCE_DIR=${WORKING_SOURCE_DIR:-/home/ubuntu/opendeck-source}
# File .env production của backend, để NGOÀI repo (không commit secret)
ENV_FILE=${ENV_FILE:-/home/ubuntu/opendeck-shared/backend.env}

# validate branch input
validateBranch()
{
    if [ -z "$1" ]
    then
        echo "Invalid branch"
        exit 1
    fi
}

# pull source mới nhất của branch
pullSource()
{
    echo "Pulling source on branch $BRANCH..."
    set -x
    cd "$WORKING_SOURCE_DIR" || exit 1
    git reset --hard
    git clean -fd
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
    corepack enable
    pnpm install --frozen-lockfile
    set +x
}

# build Web
buildWeb()
{
    echo "Building Web on branch $BRANCH..."
    set -x
    cd "$WORKING_SOURCE_DIR" || exit 1
    pnpm --filter @opendeck/frontend build || exit 1
    pm2 startOrReload deploy/ecosystem.config.cjs --only opendeck-web
    pm2 save
    set +x
}

# build server
buildAPI()
{
    echo "Building API on branch $BRANCH..."
    set -x
    cd "$WORKING_SOURCE_DIR" || exit 1
    if [ ! -f "$ENV_FILE" ]; then
        echo "Missing env file: $ENV_FILE (xem apps/backend/.env.example)"
        exit 1
    fi
    cp "$ENV_FILE" "$WORKING_SOURCE_DIR/apps/backend/.env"
    rm -rf apps/backend/dist
    pnpm --filter @opendeck/backend build || exit 1
    # Migration tự chạy khi app khởi động (migrationsRun: true)
    pm2 startOrReload deploy/ecosystem.config.cjs --only opendeck-api --update-env
    pm2 save
    set +x
}

validateBranch "$BRANCH"

PS3='Please select server: '
options=("Web" "API" "All" "Quit")
select opt in "${options[@]}"
do
    case $opt in
        "Web")
            pullSource
            buildWeb
            exit 0
        ;;
        "API")
            pullSource
            buildAPI
            exit 0
        ;;
        "All")
            pullSource
            buildAPI
            buildWeb
            exit 0
        ;;
        "Quit")
            break
        ;;
        *) echo "invalid option $REPLY";;
    esac
done
