import type { FC } from 'react'
import type { IconProps } from './types'

export const PrismaIcon: FC<IconProps> = ({ size = 16 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 27 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0.247636 21.9646C-0.077913 21.4511 -0.0828312 20.7971 0.234957 20.2786L12.2003 0.760712C12.8658 -0.324865 14.4728 -0.229945 15.0059 0.926419L25.9368 24.6382C26.3423 25.518 25.8755 26.5531 24.9475 26.8315L7.94367 31.9327C7.25953 32.1379 6.52239 31.8629 6.13997 31.2596L0.247636 21.9646ZM13.5808 6.46758C13.6961 5.89341 14.4828 5.81061 14.7152 6.34819L22.2552 23.7953C22.3971 24.1238 22.2205 24.5027 21.8775 24.605L10.1292 28.112C9.69738 28.2409 9.28372 27.8636 9.37245 27.4217L13.5808 6.46758Z"
        fill="white"
      />
    </svg>
  )
}
