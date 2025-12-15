import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { InferenceClient } from '@huggingface/inference'

// Create server instance
const server = new McpServer({
    name: 'YOUR_SERVER_NAME',
    version: '1.0.0'
})

server.registerTool(
    'greet',
    {
        description: '이름과 언어를 입력하면 인사말을 반환합니다.',
        inputSchema: z.object({
            name: z.string().describe('인사할 사람의 이름'),
            language: z
                .enum(['ko', 'en','id'])
                .optional()
                .default('en')
                .describe('인사 언어 (기본값: en)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('인사말')
                    })
                )
                .describe('인사말')
        })
    },
    async ({ name, language }) => {
        const greeting =
            language === 'ko'
                ? `안녕하세요, ${name}님!`
                : language === 'id'
                ? `Halo, ${name}! 👋 Senang bertemu dengan Anda!`
                : `Hey there, ${name}! 👋 Nice to meet you!`

        return {
            content: [
                {
                    type: 'text' as const,
                    text: greeting
                }
            ],
            structuredContent: {
                content: [
                    {
                        type: 'text' as const,
                        text: greeting
                    }
                ]
            }
        }
    }
)

server.registerTool(
    'calculator',
    {
        description: '두 개의 숫자와 연산자를 입력받아 사칙연산 결과를 반환합니다.',
        inputSchema: z.object({
            a: z.number().describe('첫 번째 숫자'),
            b: z.number().describe('두 번째 숫자'),
            operator: z
                .enum(['+', '-', '*', '/'])
                .describe('연산자 (+, -, *, /)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('계산 결과')
                    })
                )
                .describe('계산 결과')
        })
    },
    async ({ a, b, operator }) => {
        let result: number
        let error: string | null = null

        try {
            switch (operator) {
                case '+':
                    result = a + b
                    break
                case '-':
                    result = a - b
                    break
                case '*':
                    result = a * b
                    break
                case '/':
                    if (b === 0) {
                        error = '0으로 나눌 수 없습니다.'
                        result = NaN
                    } else {
                        result = a / b
                    }
                    break
            }

            const resultText = error
                ? `오류: ${error}`
                : `${a} ${operator} ${b} = ${result}`

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            }
        } catch (e) {
            const errorMessage = `계산 중 오류가 발생했습니다: ${e instanceof Error ? e.message : String(e)}`
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: errorMessage
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: errorMessage
                        }
                    ]
                }
            }
        }
    }
)

// 지역/나라 이름을 IANA 타임존으로 매핑하는 헬퍼 함수
function getTimezoneFromLocation(location: string): string {
    const locationMap: Record<string, string> = {
        // 주요 도시
        '서울': 'Asia/Seoul',
        'Seoul': 'Asia/Seoul',
        '도쿄': 'Asia/Tokyo',
        'Tokyo': 'Asia/Tokyo',
        '베이징': 'Asia/Shanghai',
        'Beijing': 'Asia/Shanghai',
        '상하이': 'Asia/Shanghai',
        'Shanghai': 'Asia/Shanghai',
        '뉴욕': 'America/New_York',
        'New York': 'America/New_York',
        '로스앤젤레스': 'America/Los_Angeles',
        'Los Angeles': 'America/Los_Angeles',
        'LA': 'America/Los_Angeles',
        '런던': 'Europe/London',
        'London': 'Europe/London',
        '파리': 'Europe/Paris',
        'Paris': 'Europe/Paris',
        '베를린': 'Europe/Berlin',
        'Berlin': 'Europe/Berlin',
        '모스크바': 'Europe/Moscow',
        'Moscow': 'Europe/Moscow',
        '시드니': 'Australia/Sydney',
        'Sydney': 'Australia/Sydney',
        '뭄바이': 'Asia/Kolkata',
        'Mumbai': 'Asia/Kolkata',
        '델리': 'Asia/Kolkata',
        'Delhi': 'Asia/Kolkata',
        '싱가포르': 'Asia/Singapore',
        'Singapore': 'Asia/Singapore',
        '방콕': 'Asia/Bangkok',
        'Bangkok': 'Asia/Bangkok',
        '두바이': 'Asia/Dubai',
        'Dubai': 'Asia/Dubai',
        // 주요 나라
        '한국': 'Asia/Seoul',
        'Korea': 'Asia/Seoul',
        'South Korea': 'Asia/Seoul',
        '일본': 'Asia/Tokyo',
        'Japan': 'Asia/Tokyo',
        '중국': 'Asia/Shanghai',
        'China': 'Asia/Shanghai',
        '미국': 'America/New_York',
        'USA': 'America/New_York',
        'United States': 'America/New_York',
        '영국': 'Europe/London',
        'UK': 'Europe/London',
        'United Kingdom': 'Europe/London',
        '프랑스': 'Europe/Paris',
        'France': 'Europe/Paris',
        '독일': 'Europe/Berlin',
        'Germany': 'Europe/Berlin',
        '러시아': 'Europe/Moscow',
        'Russia': 'Europe/Moscow',
        '호주': 'Australia/Sydney',
        'Australia': 'Australia/Sydney',
        '인도': 'Asia/Kolkata',
        'India': 'Asia/Kolkata',
        '태국': 'Asia/Bangkok',
        'Thailand': 'Asia/Bangkok',
        'UAE': 'Asia/Dubai',
        'United Arab Emirates': 'Asia/Dubai',
    }

    // 대소문자 구분 없이 검색
    const normalizedLocation = location.trim()
    const timezone = locationMap[normalizedLocation] || locationMap[normalizedLocation.toLowerCase()] || locationMap[normalizedLocation.toUpperCase()]

    // 매핑이 없으면 입력값을 그대로 타임존으로 사용 (IANA 형식일 수 있음)
    return timezone || normalizedLocation
}

server.registerTool(
    'getCurrentTime',
    {
        description: '특정 지역이나 나라를 입력받아 해당 지역의 현재 시간을 반환합니다.',
        inputSchema: z.object({
            location: z.string().describe('지역 또는 나라 이름 (예: 서울, Seoul, Asia/Seoul, 한국, Korea 등)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('현재 시간 정보')
                    })
                )
                .describe('현재 시간 정보')
        })
    },
    async ({ location }) => {
        try {
            const timezone = getTimezoneFromLocation(location)
            
            // 현재 시간을 해당 타임존으로 가져오기
            const now = new Date()
            const formatter = new Intl.DateTimeFormat('ko-KR', {
                timeZone: timezone,
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                weekday: 'long',
                hour12: false
            })

            const formattedTime = formatter.format(now)
            
            // ISO 형식도 추가
            const isoFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            })
            const isoTime = isoFormatter.format(now)

            const resultText = `${location} (${timezone})의 현재 시간:\n${formattedTime}\n(${isoTime})`

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            }
        } catch (e) {
            const errorMessage = `시간을 가져오는 중 오류가 발생했습니다: ${e instanceof Error ? e.message : String(e)}\n올바른 지역 이름이나 IANA 타임존(예: Asia/Seoul)을 입력해주세요.`
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: errorMessage
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: errorMessage
                        }
                    ]
                }
            }
        }
    }
)

server.registerTool(
    'geocode',
    {
        description: '도시 이름이나 주소를 입력받아 위도와 경도 좌표를 반환합니다. Nominatim OpenStreetMap API를 사용합니다.',
        inputSchema: z.object({
            query: z.string().describe('도시 이름 또는 주소 (예: 서울, Seoul, Paris, France, 1600 Amphitheatre Parkway, Mountain View 등)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('위도와 경도 좌표 정보')
                    })
                )
                .describe('위도와 경도 좌표 정보')
        })
    },
    async ({ query }) => {
        try {
            // Nominatim API 호출
            const encodedQuery = encodeURIComponent(query)
            const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=1&addressdetails=1`
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'MCP-Server/1.0.0' // Nominatim은 User-Agent를 요구합니다
                }
            })

            if (!response.ok) {
                throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`)
            }

            const data = await response.json()

            if (!Array.isArray(data) || data.length === 0) {
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: `"${query}"에 대한 검색 결과를 찾을 수 없습니다. 다른 검색어를 시도해주세요.`
                        }
                    ],
                    structuredContent: {
                        content: [
                            {
                                type: 'text' as const,
                                text: `"${query}"에 대한 검색 결과를 찾을 수 없습니다. 다른 검색어를 시도해주세요.`
                            }
                        ]
                    }
                }
            }

            const result = data[0]
            const lat = parseFloat(result.lat)
            const lon = parseFloat(result.lon)
            const displayName = result.display_name || query

            // 주소 정보가 있으면 포함
            let addressInfo = ''
            if (result.address) {
                const addressParts: string[] = []
                if (result.address.house_number) addressParts.push(result.address.house_number)
                if (result.address.road) addressParts.push(result.address.road)
                if (result.address.city) addressParts.push(result.address.city)
                if (result.address.state) addressParts.push(result.address.state)
                if (result.address.country) addressParts.push(result.address.country)
                
                if (addressParts.length > 0) {
                    addressInfo = `\n주소: ${addressParts.join(', ')}`
                }
            }

            const resultText = `위치: ${displayName}${addressInfo}\n위도: ${lat}\n경도: ${lon}\n좌표: (${lat}, ${lon})`

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            }
        } catch (e) {
            const errorMessage = `지오코딩 중 오류가 발생했습니다: ${e instanceof Error ? e.message : String(e)}\n네트워크 연결을 확인하거나 나중에 다시 시도해주세요.`
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: errorMessage
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: errorMessage
                        }
                    ]
                }
            }
        }
    }
)

// Weather code를 날씨 설명으로 변환하는 헬퍼 함수
function getWeatherDescription(code: number): string {
    const weatherCodes: Record<number, string> = {
        0: '맑음',
        1: '대체로 맑음',
        2: '부분적으로 흐림',
        3: '흐림',
        45: '안개',
        48: '서리 안개',
        51: '약한 이슬비',
        53: '보통 이슬비',
        55: '강한 이슬비',
        56: '약한 진눈깨비',
        57: '강한 진눈깨비',
        61: '약한 비',
        63: '보통 비',
        65: '강한 비',
        66: '얼음 비',
        67: '강한 얼음 비',
        71: '약한 눈',
        73: '보통 눈',
        75: '강한 눈',
        77: '눈알',
        80: '약한 소나기',
        81: '보통 소나기',
        82: '강한 소나기',
        85: '약한 눈 소나기',
        86: '강한 눈 소나기',
        95: '뇌우',
        96: '우박을 동반한 뇌우',
        99: '강한 우박을 동반한 뇌우'
    }
    return weatherCodes[code] || `날씨 코드: ${code}`
}

server.registerTool(
    'getWeather',
    {
        description: '위도와 경도 좌표, 예보 기간을 입력받아 해당 위치의 현재 날씨와 예보 정보를 제공합니다. Open-Meteo Weather API를 사용합니다.',
        inputSchema: z.object({
            latitude: z.number().describe('위도 (WGS84 좌표계)'),
            longitude: z.number().describe('경도 (WGS84 좌표계)'),
            forecastDays: z
                .number()
                .int()
                .min(1)
                .max(16)
                .optional()
                .default(7)
                .describe('예보 기간 (일수, 기본값: 7, 최대: 16)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('날씨 정보')
                    })
                )
                .describe('날씨 정보')
        })
    },
    async ({ latitude, longitude, forecastDays }) => {
        try {
            // Open-Meteo API 호출
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&forecast_days=${forecastDays}&timezone=auto`
            
            const response = await fetch(url)

            if (!response.ok) {
                throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`)
            }

            const data = await response.json()

            if (data.error) {
                throw new Error(data.reason || '알 수 없는 오류가 발생했습니다.')
            }

            // 현재 날씨 정보
            let resultText = `📍 위치: 위도 ${latitude}, 경도 ${longitude}\n`
            resultText += `⏰ 시간대: ${data.timezone || '자동'}\n`
            resultText += `📊 해발: ${data.elevation?.toFixed(1) || 'N/A'}m\n\n`

            if (data.current_weather) {
                const current = data.current_weather
                resultText += `🌤️ 현재 날씨\n`
                resultText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
                resultText += `온도: ${current.temperature}°C\n`
                resultText += `날씨: ${getWeatherDescription(current.weather_code)}\n`
                resultText += `풍속: ${current.windspeed} km/h\n`
                resultText += `풍향: ${current.winddirection}°\n`
                resultText += `시간: ${current.time}\n\n`
            }

            // 일별 예보 정보
            if (data.daily && data.daily.time) {
                resultText += `📅 ${forecastDays}일 예보\n`
                resultText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
                
                const days = data.daily.time.length
                for (let i = 0; i < Math.min(days, forecastDays); i++) {
                    const date = new Date(data.daily.time[i])
                    const dayName = date.toLocaleDateString('ko-KR', { weekday: 'short' })
                    const dateStr = date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                    
                    resultText += `\n${dateStr} (${dayName})\n`
                    
                    if (data.daily.temperature_2m_max && data.daily.temperature_2m_max[i] !== undefined) {
                        resultText += `  최고: ${data.daily.temperature_2m_max[i]}°C`
                    }
                    if (data.daily.temperature_2m_min && data.daily.temperature_2m_min[i] !== undefined) {
                        resultText += ` / 최저: ${data.daily.temperature_2m_min[i]}°C`
                    }
                    resultText += `\n`
                    
                    if (data.daily.weather_code && data.daily.weather_code[i] !== undefined) {
                        resultText += `  날씨: ${getWeatherDescription(data.daily.weather_code[i])}\n`
                    }
                    
                    if (data.daily.precipitation_sum && data.daily.precipitation_sum[i] !== undefined) {
                        const precip = data.daily.precipitation_sum[i]
                        if (precip > 0) {
                            resultText += `  강수량: ${precip}mm\n`
                        }
                    }
                }
            }

            // 다음 몇 시간 예보 (최대 24시간)
            if (data.hourly && data.hourly.time) {
                resultText += `\n\n⏰ 향후 24시간 예보 (시간별)\n`
                resultText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
                
                const hourlyCount = Math.min(24, data.hourly.time.length)
                for (let i = 0; i < hourlyCount; i++) {
                    const time = new Date(data.hourly.time[i])
                    const timeStr = time.toLocaleString('ko-KR', { 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    })
                    
                    resultText += `\n${timeStr}\n`
                    
                    if (data.hourly.temperature_2m && data.hourly.temperature_2m[i] !== undefined) {
                        resultText += `  온도: ${data.hourly.temperature_2m[i]}°C`
                    }
                    
                    if (data.hourly.weather_code && data.hourly.weather_code[i] !== undefined) {
                        resultText += ` | ${getWeatherDescription(data.hourly.weather_code[i])}`
                    }
                    
                    if (data.hourly.precipitation && data.hourly.precipitation[i] !== undefined && data.hourly.precipitation[i] > 0) {
                        resultText += ` | 강수: ${data.hourly.precipitation[i]}mm`
                    }
                    
                    if (data.hourly.wind_speed_10m && data.hourly.wind_speed_10m[i] !== undefined) {
                        resultText += ` | 풍속: ${data.hourly.wind_speed_10m[i]} km/h`
                    }
                    
                    resultText += `\n`
                }
            }

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            }
        } catch (e) {
            const errorMessage = `날씨 정보를 가져오는 중 오류가 발생했습니다: ${e instanceof Error ? e.message : String(e)}\n네트워크 연결을 확인하거나 나중에 다시 시도해주세요.`
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: errorMessage
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: errorMessage
                        }
                    ]
                }
            }
        }
    }
)

// Hugging Face 클라이언트 초기화
const hfClient = new InferenceClient(process.env.HF_TOKEN)

// Blob을 Base64로 변환하는 헬퍼 함수
async function blobToBase64(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    return buffer.toString('base64')
}

server.registerTool(
    'generateImage',
    {
        description: '텍스트 프롬프트를 입력받아 AI 이미지를 생성합니다. FLUX.1-schnell 모델을 사용합니다.',
        inputSchema: z.object({
            prompt: z.string().describe('이미지 생성을 위한 텍스트 프롬프트 (영어 권장)')
        })
    },
    async ({ prompt }) => {
        try {
            // Hugging Face API를 통해 이미지 생성
            const image = await hfClient.textToImage({
                provider: 'auto',
                model: 'black-forest-labs/FLUX.1-schnell',
                inputs: prompt,
                parameters: { num_inference_steps: 5 }
            })

            // 이미지를 Base64로 변환
            let base64Data: string
            if (typeof image === 'object' && image !== null && 'arrayBuffer' in image) {
                // Blob인 경우
                base64Data = await blobToBase64(image as Blob)
            } else if (typeof image === 'string') {
                // 이미 string인 경우 (base64 또는 URL)
                base64Data = image
            } else {
                // 기타 경우 - Buffer 등
                const buffer = Buffer.from(image as ArrayBuffer)
                base64Data = buffer.toString('base64')
            }

            return {
                content: [
                    {
                        type: 'image' as const,
                        data: base64Data,
                        mimeType: 'image/png'
                    }
                ]
            }
        } catch (e) {
            const errorMessage = `이미지 생성 중 오류가 발생했습니다: ${e instanceof Error ? e.message : String(e)}\nHF_TOKEN 환경변수가 설정되어 있는지 확인해주세요.`
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: errorMessage
                    }
                ]
            }
        }
    }
)

// 코드 리뷰 프롬프트 템플릿
const codeReviewPromptTemplate = `당신은 경험이 풍부한 소프트웨어 엔지니어입니다. 아래 코드를 리뷰해주세요.

## 코드 리뷰 가이드라인

다음 항목들을 중심으로 리뷰를 진행해주세요:

1. **코드 품질**
   - 가독성과 명확성
   - 네이밍 컨벤션
   - 코드 구조와 조직화

2. **버그 및 잠재적 문제**
   - 논리적 오류
   - 엣지 케이스 처리
   - 예외 처리

3. **성능**
   - 알고리즘 효율성
   - 불필요한 연산
   - 메모리 사용

4. **보안**
   - 보안 취약점
   - 입력 검증
   - 데이터 보호

5. **유지보수성**
   - 코드 재사용성
   - 확장 가능성
   - 문서화

6. **모범 사례**
   - 언어별 베스트 프랙티스
   - 디자인 패턴 적용
   - 테스트 가능성

## 리뷰할 코드

\`\`\`
{CODE}
\`\`\`

## 리뷰 형식

다음 형식으로 리뷰를 작성해주세요:

### ✅ 잘된 점
- [구체적인 칭찬 사항]

### ⚠️ 개선이 필요한 점
- [구체적인 개선 사항과 이유]

### 🔧 제안사항
- [구체적인 개선 제안과 예시 코드]

### 📝 전체 평가
[전체적인 평가와 우선순위가 높은 개선 사항]`

server.registerTool(
    'codeReviewPrompt',
    {
        description: '코드를 입력받아 코드 리뷰를 위한 프롬프트 템플릿과 결합하여 반환합니다.',
        inputSchema: z.object({
            code: z.string().describe('리뷰할 코드'),
            language: z
                .string()
                .optional()
                .describe('코드 언어 (예: typescript, javascript, python 등)'),
            focusAreas: z
                .array(z.string())
                .optional()
                .describe('특별히 집중할 리뷰 영역 (예: ["성능", "보안", "가독성"])')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('코드 리뷰 프롬프트')
                    })
                )
                .describe('코드 리뷰 프롬프트')
        })
    },
    async ({ code, language, focusAreas }) => {
        try {
            // 언어 정보가 있으면 추가
            let languageInfo = ''
            if (language) {
                languageInfo = `\n**프로그래밍 언어**: ${language}\n`
            }

            // 집중 영역이 있으면 추가
            let focusInfo = ''
            if (focusAreas && focusAreas.length > 0) {
                focusInfo = `\n**특별히 집중할 영역**: ${focusAreas.join(', ')}\n`
            }

            // 프롬프트 템플릿에 코드 삽입
            const prompt = codeReviewPromptTemplate
                .replace('{CODE}', code)
                .replace('## 리뷰할 코드', `## 리뷰할 코드${languageInfo}${focusInfo}`)

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: prompt
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: prompt
                        }
                    ]
                }
            }
        } catch (e) {
            const errorMessage = `프롬프트 생성 중 오류가 발생했습니다: ${e instanceof Error ? e.message : String(e)}`
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: errorMessage
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: errorMessage
                        }
                    ]
                }
            }
        }
    }
)

// 주요 도시 좌표 정보
const cityCoords: Record<string, { lat: number; lon: number; name: string }> = {
    seoul: { lat: 37.5666791, lon: 126.9782914, name: '서울' },
    busan: { lat: 35.1799528, lon: 129.0752365, name: '부산' },
    daegu: { lat: 35.8713, lon: 128.6018, name: '대구' },
    incheon: { lat: 37.456, lon: 126.7052, name: '인천' },
    gwangju: { lat: 35.1594647, lon: 126.8515034, name: '광주' },
    daejeon: { lat: 36.3322464, lon: 127.4346482, name: '대전' }
}

// 날씨 리소스 등록
for (const [cityKey, cityInfo] of Object.entries(cityCoords)) {
    server.resource(
        `weather-${cityKey}`,
        `weather://${cityKey}`,
        {
            description: `${cityInfo.name}의 현재 날씨 및 7일 예보`,
            mimeType: 'text/plain'
        },
        async () => {
            try {
                // Open-Meteo API 호출
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${cityInfo.lat}&longitude=${cityInfo.lon}&current_weather=true&hourly=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&forecast_days=7&timezone=auto`
                
                const response = await fetch(url)
                if (!response.ok) {
                    throw new Error(`API 요청 실패: ${response.status}`)
                }

                const data = await response.json()
                if (data.error) {
                    throw new Error(data.reason || '알 수 없는 오류')
                }

                // 날씨 정보 포맷팅
                let resultText = `📍 ${cityInfo.name} 날씨 정보\n`
                resultText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`

                if (data.current_weather) {
                    const current = data.current_weather
                    resultText += `🌤️ 현재 날씨\n`
                    resultText += `온도: ${current.temperature}°C\n`
                    resultText += `날씨: ${getWeatherDescription(current.weather_code)}\n`
                    resultText += `풍속: ${current.windspeed} km/h\n`
                    resultText += `풍향: ${current.winddirection}°\n\n`
                }

                if (data.daily && data.daily.time) {
                    resultText += `📅 7일 예보\n`
                    resultText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
                    
                    for (let i = 0; i < Math.min(7, data.daily.time.length); i++) {
                        const date = new Date(data.daily.time[i])
                        const dayName = date.toLocaleDateString('ko-KR', { weekday: 'short' })
                        const dateStr = date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                        
                        resultText += `\n${dateStr} (${dayName})\n`
                        
                        if (data.daily.temperature_2m_max?.[i] !== undefined) {
                            resultText += `  최고: ${data.daily.temperature_2m_max[i]}°C`
                        }
                        if (data.daily.temperature_2m_min?.[i] !== undefined) {
                            resultText += ` / 최저: ${data.daily.temperature_2m_min[i]}°C`
                        }
                        resultText += `\n`
                        
                        if (data.daily.weather_code?.[i] !== undefined) {
                            resultText += `  날씨: ${getWeatherDescription(data.daily.weather_code[i])}\n`
                        }
                        
                        if (data.daily.precipitation_sum?.[i] !== undefined && data.daily.precipitation_sum[i] > 0) {
                            resultText += `  강수량: ${data.daily.precipitation_sum[i]}mm\n`
                        }
                    }
                }

                return {
                    contents: [
                        {
                            uri: `weather://${cityKey}`,
                            mimeType: 'text/plain',
                            text: resultText
                        }
                    ]
                }
            } catch (e) {
                const errorMessage = `날씨 정보를 가져오는 중 오류가 발생했습니다: ${e instanceof Error ? e.message : String(e)}`
                return {
                    contents: [
                        {
                            uri: `weather://${cityKey}`,
                            mimeType: 'text/plain',
                            text: errorMessage
                        }
                    ]
                }
            }
        }
    )

    // 위치 리소스 등록
    server.resource(
        `location-${cityKey}`,
        `location://${cityKey}`,
        {
            description: `${cityInfo.name}의 위도/경도 좌표 정보`,
            mimeType: 'application/json'
        },
        async () => {
            const locationData = {
                city: cityInfo.name,
                latitude: cityInfo.lat,
                longitude: cityInfo.lon,
                coordinates: `(${cityInfo.lat}, ${cityInfo.lon})`
            }

            return {
                contents: [
                    {
                        uri: `location://${cityKey}`,
                        mimeType: 'application/json',
                        text: JSON.stringify(locationData, null, 2)
                    }
                ]
            }
        }
    )

    // 시간 리소스 등록
    server.resource(
        `time-${cityKey}`,
        `time://${cityKey}`,
        {
            description: `${cityInfo.name}의 현재 시간 정보`,
            mimeType: 'text/plain'
        },
        async () => {
            const timezone = 'Asia/Seoul'
            
            const now = new Date()
            const formatter = new Intl.DateTimeFormat('ko-KR', {
                timeZone: timezone,
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                weekday: 'long',
                hour12: false
            })

            const formattedTime = formatter.format(now)
            const resultText = `${cityInfo.name} (${timezone})의 현재 시간:\n${formattedTime}`

            return {
                contents: [
                    {
                        uri: `time://${cityKey}`,
                        mimeType: 'text/plain',
                        text: resultText
                    }
                ]
            }
        }
    )
}

server
    .connect(new StdioServerTransport())
    .catch(console.error)
    .then(() => {
        console.log('MCP server started')
    })
