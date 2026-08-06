// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import type { FC } from 'react'
import styles from './ParseErrorDisplay.module.css'

type ErrorObject = {
  name: string
  message: string
}

type Props = {
  errors: ErrorObject[]
}

export const ParseErrorDisplay: FC<Props> = ({ errors }) => {
  return (
    <div className={styles.wrapper}>
      <div className={styles.message1}>
        <div className={styles.message1Title}>
          Oh no! We’ve encountered some errors 🛸💫
        </div>

        {errors[0] && (
          <div className={styles.message1Sentence}>
            <details>
              <summary>View errors</summary>
              <ul>
                <li key={errors[0].name}>
                  <code>
                    {errors[0].name}: {errors[0].message}
                  </code>
                </li>
              </ul>
            </details>
          </div>
        )}
        <div className={styles.message1Sentence}>
          <p>
            It seems some SQL statements couldn’t make it through the parser’s
            orbit.
          </p>
          <p>
            Parsing every SQL dialect is like navigating an asteroid field—it’s
            tricky, but we’re working on it!
          </p>
        </div>
      </div>

      <div className={styles.message2}>
        <div className={styles.message2Title}>
          🚀 Here’s what you can do next
        </div>
        <div className={styles.message2Sentence}>
          <p>Adjust your SQL: A small update might clear things up.</p>
          <p>
            Move ahead with your project: You can still create it! The
            unrecognized statements will just be skipped.
          </p>
        </div>
        {/* Upstream's guide. This fork does not change the parser, so it is
            still the right place to look. */}
        <a
          href="https://liambx.com/docs/parser/troubleshooting"
          target="_blank"
          className={styles.callout}
          rel="noreferrer"
        >
          Check out the upstream troubleshooting guide →
        </a>
      </div>
    </div>
  )
}
