#!/usr/bin/env python3
"""
Test script for the new service URL management and reply generation endpoints.
Run this after starting the backend to verify everything works.
"""

import asyncio
import httpx
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"

async def test_service_urls():
    """Test service URL endpoints"""
    print("🔗 Testing Service URL Management...")
    
    async with httpx.AsyncClient() as client:
        # Test getting all service URLs
        print("\n1. Getting all service URLs...")
        response = await client.get(f"{BASE_URL}/services/urls")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Service URLs retrieved successfully")
            print(f"   Pollinations URL: {data['pollinations_url']}")
            print(f"   Cache expires at: {data['cache_expires_at']}")
            print(f"   Last updated: {data['last_updated']}")
        else:
            print(f"❌ Failed to get service URLs: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
        
        # Test getting specific service URL
        print("\n2. Getting Pollinations service URL...")
        response = await client.get(f"{BASE_URL}/services/urls/pollinations")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Pollinations URL retrieved successfully")
            print(f"   URL: {data['url']}")
            print(f"   Active: {data['is_active']}")
            print(f"   Last checked: {data['last_checked']}")
        else:
            print(f"❌ Failed to get Pollinations URL: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
        
        # Test refreshing cache
        print("\n3. Testing cache refresh...")
        response = await client.post(f"{BASE_URL}/services/urls/pollinations/refresh")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Cache refreshed successfully")
            print(f"   Message: {data['message']}")
            print(f"   URL: {data['url']}")
        else:
            print(f"❌ Failed to refresh cache: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    
    return True

async def test_reply_generation():
    """Test reply generation endpoint (requires authentication)"""
    print("\n🤖 Testing Reply Generation...")
    print("⚠️  Note: This test requires authentication and will fail without a valid token")
    
    async with httpx.AsyncClient() as client:
        # Test reply generation
        print("\n1. Testing reply generation...")
        
        test_request = {
            "context": "Just launched my new startup! Excited to share it with the world.",
            "platform": "x",
            "tone": "supportive",
            "length": "medium",
            "user_writing_style": "friendly and encouraging"
        }
        
        response = await client.post(
            f"{BASE_URL}/services/generate-reply",
            json=test_request,
            headers={"Authorization": "Bearer fake-token-for-testing"}
        )
        
        if response.status_code == 401:
            print(f"⚠️  Authentication required (expected): {response.status_code}")
            print(f"   This is normal - the endpoint requires a valid Supabase JWT token")
            return True
        elif response.status_code == 200:
            data = response.json()
            print(f"✅ Reply generated successfully")
            print(f"   Reply: {data['reply']}")
            print(f"   Service used: {data['service_used']}")
        else:
            print(f"❌ Unexpected response: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    
    return True

async def test_health_check():
    """Test basic health check"""
    print("🏥 Testing Health Check...")
    
    async with httpx.AsyncClient() as client:
        response = await client.get("http://localhost:8000/health")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Backend is healthy")
            print(f"   Status: {data['status']}")
            print(f"   Environment: {data['environment']}")
            print(f"   Database: {data['database']}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    
    return True

async def main():
    """Run all tests"""
    print("🧪 HumanReplies Backend Service Tests")
    print("=" * 50)
    
    # Test health check first
    if not await test_health_check():
        print("\n❌ Health check failed - make sure the backend is running")
        return
    
    # Test service URL management
    if not await test_service_urls():
        print("\n❌ Service URL tests failed")
        return
    
    # Test reply generation
    if not await test_reply_generation():
        print("\n❌ Reply generation tests failed")
        return
    
    print("\n" + "=" * 50)
    print("🎉 All tests completed successfully!")
    print("\n📝 Next steps:")
    print("   1. Set up Supabase authentication to test reply generation")
    print("   2. Load the extension and test end-to-end functionality")
    print("   3. Check the database to see stored service URLs")

if __name__ == "__main__":
    asyncio.run(main())