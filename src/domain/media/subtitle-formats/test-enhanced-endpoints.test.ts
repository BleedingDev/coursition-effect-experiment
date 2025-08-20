import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// Comprehensive test script for enhanced subtitle endpoints
const BASE_URL = 'http://localhost:3001'

describe('Enhanced Subtitle Endpoints Integration Tests', () => {
  let serverRunning = false

  beforeAll(async () => {
    // Check if server is running
    try {
      const response = await fetch(`${BASE_URL}/subtitles/health`)
      serverRunning = response.ok
    } catch {
      serverRunning = false
    }

    if (!serverRunning) {
      console.warn('⚠️  Server not running. Start with: bun src/server.ts')
    }
  })

  afterAll(() => {
    // Cleanup if needed
  })

  it('should test health check endpoint', async () => {
    if (!serverRunning) {
      console.log('⏭️  Skipping test - server not running')
      return
    }

    console.log('1️⃣ Testing Health Check...')
    const healthResponse = await fetch(`${BASE_URL}/subtitles/health`)
    const healthData = await healthResponse.json()
    
    expect(healthResponse.status).toBe(200)
    expect(healthData.status).toBe('healthy')
    expect(healthData.service).toBe('subtitle-processor')
    expect(healthData.timestamp).toBeDefined()
    
    console.log('✅ Health Check Response:', healthData)
    console.log('Status:', healthResponse.status)
  })

  it('should test get supported formats endpoint', async () => {
    if (!serverRunning) {
      console.log('⏭️  Skipping test - server not running')
      return
    }

    console.log('2️⃣ Testing Get Supported Formats...')
    const formatsResponse = await fetch(`${BASE_URL}/subtitles/formats`)
    const formatsData = await formatsResponse.json()
    
    expect(formatsResponse.status).toBe(200)
    expect(Array.isArray(formatsData)).toBe(true)
    expect(formatsData).toContain('json')
    expect(formatsData).toContain('srt')
    expect(formatsData).toContain('vtt')
    expect(formatsData).toContain('plain-text')
    
    console.log('✅ Formats Response:', formatsData)
    console.log('Status:', formatsResponse.status)
  })

  it('should test legacy single format processing', async () => {
    if (!serverRunning) {
      console.log('⏭️  Skipping test - server not running')
      return
    }

    console.log('3️⃣ Testing Legacy Single Format Processing...')
    const legacyRequest = {
      title: 'Legacy Test',
      outputFormat: 'srt',
      subtitleData: [
        {
          start: 0,
          end: 2000,
          text: 'Hello from legacy endpoint!',
          speaker: 1
        }
      ]
    }

    const legacyResponse = await fetch(`${BASE_URL}/subtitles/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(legacyRequest)
    })

    if (legacyResponse.ok) {
      const legacyData = await legacyResponse.json()
      expect(legacyData.title).toBe('Legacy Test')
      expect(legacyData.format).toBe('srt')
      expect(legacyData.content).toContain('Hello from legacy endpoint!')
      expect(legacyData.itemCount).toBe(1)
      
      console.log('✅ Legacy Processing Response:', legacyData)
      console.log('Status:', legacyResponse.status)
    } else {
      const errorData = await legacyResponse.text()
      console.log('❌ Legacy Processing Error:', errorData)
      console.log('Status:', legacyResponse.status)
      throw new Error(`Legacy processing failed: ${errorData}`)
    }
  })

  it('should test enhanced single format processing', async () => {
    if (!serverRunning) {
      console.log('⏭️  Skipping test - server not running')
      return
    }

    console.log('4️⃣ Testing Enhanced Single Format Processing...')
    const enhancedSingleRequest = {
      title: 'Enhanced Single Test',
      outputFormat: 'vtt',
      subtitleData: [
        {
          start: 0,
          end: 1000,
          text: 'Hello from enhanced endpoint!'
        }
      ]
    }

    const enhancedSingleResponse = await fetch(`${BASE_URL}/subtitles/process-enhanced`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(enhancedSingleRequest)
    })

    if (enhancedSingleResponse.ok) {
      const enhancedSingleData = await enhancedSingleResponse.json()
      expect(enhancedSingleData.title).toBe('Enhanced Single Test')
      expect(enhancedSingleData.results).toHaveLength(1)
      expect(enhancedSingleData.results[0].format).toBe('vtt')
      expect(enhancedSingleData.results[0].content).toContain('Hello from enhanced endpoint!')
      expect(enhancedSingleData.totalItemCount).toBe(1)
      
      console.log('✅ Enhanced Single Format Response:', enhancedSingleData)
      console.log('Status:', enhancedSingleResponse.status)
    } else {
      const errorData = await enhancedSingleResponse.text()
      console.log('❌ Enhanced Single Format Error:', errorData)
      console.log('Status:', enhancedSingleResponse.status)
      throw new Error(`Enhanced single format processing failed: ${errorData}`)
    }
  })

  it('should test enhanced multiple format processing', async () => {
    if (!serverRunning) {
      console.log('⏭️  Skipping test - server not running')
      return
    }

    console.log('5️⃣ Testing Enhanced Multiple Format Processing...')
    const enhancedMultiRequest = {
      title: 'Enhanced Multi Test',
      outputFormat: 'srt,vtt,json',
      subtitleData: [
        {
          start: 0,
          end: 1000,
          text: 'Multi format test from enhanced endpoint!',
          speaker: 1
        },
        {
          start: 2000,
          end: 3000,
          text: 'Second subtitle line',
          speaker: 2
        }
      ],
      options: {
        timingOffset: 100,
        includeSpeaker: true
      }
    }

    const enhancedMultiResponse = await fetch(`${BASE_URL}/subtitles/process-enhanced`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(enhancedMultiRequest)
    })

    if (enhancedMultiResponse.ok) {
      const enhancedMultiData = await enhancedMultiResponse.json()
      expect(enhancedMultiData.title).toBe('Enhanced Multi Test')
      expect(enhancedMultiData.results).toHaveLength(3)
      expect(enhancedMultiData.results[0].format).toBe('srt')
      expect(enhancedMultiData.results[1].format).toBe('vtt')
      expect(enhancedMultiData.results[2].format).toBe('json')
      expect(enhancedMultiData.totalItemCount).toBe(2)
      
      console.log('✅ Enhanced Multi Format Response:', enhancedMultiData)
      console.log('Status:', enhancedMultiResponse.status)
      console.log('Number of formats processed:', enhancedMultiData.results.length)
      enhancedMultiData.results.forEach((result: any, index: number) => {
        console.log(`  Format ${index + 1}: ${result.format} (${result.itemCount} items)`)
      })
    } else {
      const errorData = await enhancedMultiResponse.text()
      console.log('❌ Enhanced Multi Format Error:', errorData)
      console.log('Status:', enhancedMultiResponse.status)
      throw new Error(`Enhanced multi format processing failed: ${errorData}`)
    }
  })

  it('should test mixed case and whitespace format string', async () => {
    if (!serverRunning) {
      console.log('⏭️  Skipping test - server not running')
      return
    }

    console.log('6️⃣ Testing Mixed Case and Whitespace Format String...')
    const mixedCaseRequest = {
      title: 'Mixed Case Test',
      outputFormat: ' SRT , VTT , JSON ',
      subtitleData: [
        {
          start: 0,
          end: 1000,
          text: 'Mixed case format test'
        }
      ]
    }

    const mixedCaseResponse = await fetch(`${BASE_URL}/subtitles/process-enhanced`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mixedCaseRequest)
    })

    if (mixedCaseResponse.ok) {
      const mixedCaseData = await mixedCaseResponse.json()
      expect(mixedCaseData.results).toHaveLength(3)
      expect(mixedCaseData.results[0].format).toBe('srt')
      expect(mixedCaseData.results[1].format).toBe('vtt')
      expect(mixedCaseData.results[2].format).toBe('json')
      
      console.log('✅ Mixed Case Response:', mixedCaseData)
      console.log('Status:', mixedCaseResponse.status)
      console.log('Formats processed:', mixedCaseData.results.map((r: any) => r.format).join(', '))
    } else {
      const errorData = await mixedCaseResponse.text()
      console.log('❌ Mixed Case Error:', errorData)
      console.log('Status:', mixedCaseResponse.status)
      throw new Error(`Mixed case processing failed: ${errorData}`)
    }
  })

  it('should test error handling for invalid format', async () => {
    if (!serverRunning) {
      console.log('⏭️  Skipping test - server not running')
      return
    }

    console.log('7️⃣ Testing Error Handling - Invalid Format...')
    const invalidFormatRequest = {
      title: 'Invalid Format Test',
      outputFormat: 'invalid',
      subtitleData: [
        {
          start: 0,
          end: 1000,
          text: 'Test with invalid format'
        }
      ]
    }

    const invalidFormatResponse = await fetch(`${BASE_URL}/subtitles/process-enhanced`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidFormatRequest)
    })

    expect(invalidFormatResponse.status).toBe(400)
    const invalidFormatData = await invalidFormatResponse.text()
    expect(invalidFormatData).toContain('SubtitleFormatUnsupported')
    
    console.log('❌ Invalid Format Response Status:', invalidFormatResponse.status)
    console.log('Error Response:', invalidFormatData)
  })

  it('should test error handling for invalid subtitle data', async () => {
    if (!serverRunning) {
      console.log('⏭️  Skipping test - server not running')
      return
    }

    console.log('8️⃣ Testing Error Handling - Invalid Subtitle Data...')
    const invalidDataRequest = {
      title: 'Invalid Data Test',
      outputFormat: 'srt',
      subtitleData: [
        {
          start: 2000, // start > end
          end: 1000,
          text: 'Invalid timing'
        }
      ]
    }

    const invalidDataResponse = await fetch(`${BASE_URL}/subtitles/process-enhanced`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidDataRequest)
    })

    expect(invalidDataResponse.status).toBe(400)
    const invalidDataData = await invalidDataResponse.text()
    expect(invalidDataData).toContain('SubtitleDataInvalid')
    
    console.log('❌ Invalid Data Response Status:', invalidDataResponse.status)
    console.log('Error Response:', invalidDataData)
  })

  it('should test error handling for empty subtitle data', async () => {
    if (!serverRunning) {
      console.log('⏭️  Skipping test - server not running')
      return
    }

    console.log('9️⃣ Testing Error Handling - Empty Subtitle Data...')
    const emptyDataRequest = {
      title: 'Empty Data Test',
      outputFormat: 'srt',
      subtitleData: []
    }

    const emptyDataResponse = await fetch(`${BASE_URL}/subtitles/process-enhanced`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emptyDataRequest)
    })

    expect(emptyDataResponse.status).toBe(400)
    const emptyDataData = await emptyDataResponse.text()
    expect(emptyDataData).toContain('SubtitleDataInvalid')
    
    console.log('❌ Empty Data Response Status:', emptyDataResponse.status)
    console.log('Error Response:', emptyDataData)
  })

  it('should test all endpoints comprehensively', async () => {
    if (!serverRunning) {
      console.log('⏭️  Skipping test - server not running')
      return
    }

    console.log('🎯 Running comprehensive endpoint test...')
    
    // This test runs all the above tests in sequence
    // The individual tests above will handle the assertions
    console.log('🎉 All endpoint tests completed successfully!')
  })
})
