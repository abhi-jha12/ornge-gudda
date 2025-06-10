#!/bin/bash


set -e  


RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' 

# Default options
CLEANUP=true
VERBOSE=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-cleanup)
            CLEANUP=false
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--no-cleanup] [--verbose]"
            echo "  --no-cleanup: Skip Docker cleanup steps"
            echo "  --verbose: Show detailed output"
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            exit 1
            ;;
    esac
done

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Stop nginx, terraform if running
stop_nginx() {
    if systemctl is-active --quiet nginx 2>/dev/null; then
        print_status "Stopping nginx service..."
        systemctl stop nginx
        print_success "Nginx stopped"
        return 0
    elif pgrep nginx > /dev/null 2>&1; then
        print_status "Stopping nginx process..."
        pkill nginx 2>/dev/null || true
        print_success "Nginx stopped"
        return 0
    fi
    return 1
}

# Start nginx, terraform
start_nginx() {
    if command -v systemctl > /dev/null 2>&1; then
        print_status "Starting nginx service..."
        systemctl start nginx
        print_success "Nginx started"
    else
        print_status "Starting nginx..."
        nginx
        print_success "Nginx started"
    fi
}

# Check disk space
check_disk_space() {
    local available=$(df / | awk 'NR==2{print $4}')
    local available_gb=$((available / 1024 / 1024))
    
    if [ $available_gb -lt 2 ]; then
        print_warning "Low disk space: ${available_gb}GB available"
        if [ "$CLEANUP" = true ]; then
            print_status "Running aggressive cleanup due to low disk space..."
            NGINX_WAS_RUNNING=false
            if stop_nginx; then
                NGINX_WAS_RUNNING=true
            fi
            
            docker system prune -af --volumes 2>/dev/null || true
            if [ "$NGINX_WAS_RUNNING" = true ]; then
                start_nginx
            fi
        fi
    fi
}

# Function to show Docker stats
show_docker_stats() {
    print_status "Current Docker system usage:"
    docker system df
    echo ""
}

# Main deployment function
deploy() {
    print_status "Starting deployment process..."
    
    # Check if we're in a git repository
    if [ ! -d ".git" ]; then
        print_error "Not in a git repository. Please run this script from your project root."
        exit 1
    fi
    
    # Check if docker-compose.yml exists
    if [ ! -f "docker-compose.yml" ] && [ ! -f "docker-compose.yaml" ]; then
        print_error "docker-compose.yml not found in current directory"
        exit 1
    fi
    
    # Show initial disk usage
    if [ "$VERBOSE" = true ]; then
        show_docker_stats
    fi
    
    # Check available disk space
    check_disk_space
    
    # Step 1: Stop nginx and containers
    NGINX_WAS_RUNNING=false
    if stop_nginx; then
        NGINX_WAS_RUNNING=true
    fi
    
    print_status "Stopping containers..."
    docker-compose down
    print_success "Containers stopped"
    
    # Step 2: Clean up Docker system (optional)
    if [ "$CLEANUP" = true ]; then
        print_status "Cleaning up unused Docker resources..."
        docker system prune -f
        docker image prune -f
        print_success "Docker cleanup completed"
    fi
    
    # Step 3: Pull latest code
    print_status "Pulling latest code from git..."
    git fetch origin
    
    # Check if there are any changes
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/main)
    
    if [ "$LOCAL" = "$REMOTE" ]; then
        print_warning "No new changes in repository"
    else
        print_status "Found new changes, updating..."
        git pull origin main
        print_success "Code updated successfully"
    fi
    
    # Step 4: Build and start containers
    print_status "Building and starting containers..."
    if [ "$VERBOSE" = true ]; then
        docker-compose up -d --build
    else
        docker-compose up -d --build > /dev/null 2>&1
    fi
    print_success "Containers built and started"
    
    # Step 5: Clean up dangling images after build
    if [ "$CLEANUP" = true ]; then
        print_status "Cleaning up build artifacts..."
        docker image prune -f > /dev/null 2>&1
        print_success "Build cleanup completed"
    fi
    
    # Step 6: Health check for containers
    print_status "Waiting for services to be ready..."
    sleep 5
    
    # Check if all containers are running
    FAILED_CONTAINERS=$(docker-compose ps --services --filter "status=exited")
    if [ -n "$FAILED_CONTAINERS" ]; then
        print_error "Some containers failed to start:"
        echo "$FAILED_CONTAINERS"
        print_status "Showing logs for failed containers:"
        docker-compose logs --tail=20 $FAILED_CONTAINERS
        
        # Don't start nginx if containers failed
        print_error "Deployment failed - nginx will remain stopped"
        exit 1
    fi
    
    # Step 7: Start nginx if it was running before
    if [ "$NGINX_WAS_RUNNING" = true ]; then
        start_nginx
        
        # Test nginx configuration
        sleep 2
        if ! systemctl is-active --quiet nginx 2>/dev/null && ! pgrep nginx > /dev/null 2>&1; then
            print_error "Nginx failed to start properly"
            exit 1
        fi
    fi
    
    # Step 8: Show container status
    print_status "Container status:"
    docker-compose ps
    
    # Step 9: Show final disk usage
    if [ "$VERBOSE" = true ]; then
        echo ""
        show_docker_stats
    fi
    
    print_success "Deployment completed successfully!"
    
    # Show final summary
    echo ""
    print_status "Deployment Summary:"
    echo "  - Git commit: $(git rev-parse --short HEAD)"
    echo "  - Containers: $(docker-compose ps --services | wc -l)"
    echo "  - Nginx status: $(if [ "$NGINX_WAS_RUNNING" = true ]; then echo "Running"; else echo "Not managed"; fi)"
    echo "  - Deployment time: $(date)"
}

# Trap to handle script interruption
cleanup_on_exit() {
    print_error "Deployment interrupted"
    
    # If nginx was stopped during deployment, try to restart it
    if [ "${NGINX_WAS_RUNNING:-false}" = true ]; then
        print_status "Attempting to restart nginx..."
        start_nginx || print_error "Failed to restart nginx"
    fi
    
    exit 1
}

trap cleanup_on_exit INT TERM

# Run deployment
deploy